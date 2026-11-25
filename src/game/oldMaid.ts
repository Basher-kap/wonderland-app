// Old Maid (as played in Alice in Borderland): pure rules, no React, no Firebase.
//
// The players sit on chairs in a circle (`order`, counterclockwise). Everybody gets HAND_SIZE (7) cards
// from one shuffled pile that holds a single JOKER, and at once throws away every pair of cards with the
// same number (the suit does not matter). Then, one at a time, the player whose turn it is draws one
// face-down card from the player on their RIGHT (the next one counterclockwise). If the drawn card matches a
// card they hold, both are thrown away. The turn then passes to the player they just drew from.
//
// A player is ELIMINATED (electrocuted through the wire on their chair) when:
//   - the Joker is drawn from them                 ('joker'),
//   - they run out of cards                        ('empty'): they threw away their last card, or the last
//                                                   card was drawn from them,
//   - they leave their seat = forfeit the game     ('left').
// The player who finishes the game holding the Joker clears it. That is always the last player alive: the
// Joker never pairs, so whoever holds it never runs out of cards, and it only leaves a hand by being drawn
// (which eliminates the old holder and puts the Joker into a living hand) or when its holder leaves
// (it then goes to the player who would have drawn from them).
//
// The game is a state machine run by the HOST's phone, like Battleships and Karuta: the players send
// "draw" moves, the host applies them with `apply` and calls `tick` a few times per second for the
// timers. Moves carry the `rev` of the state they were made for, and `rev` only goes up, so an old or
// repeated move is ignored.
//
// SECRET: the hands are NOT part of the state that is saved for everybody (`publicState` strips them).
// The host keeps them in memory and saves each player's own hand in a document only that player (and
// the host) can read (lobbies/{code}/oldmaidHands/{uid}); `withHands` puts them back after a host restart.
//
// HIDDEN NOTES (not in the rules window): the circle and who sits on whose right, the 15 seconds to draw
// (too slow = a random card is drawn for you), the target's hand being reshuffled before every draw so
// the position of a card tells nothing, the pairs being shown face-up in the middle, and the cap on turns.
import { makeRng } from './schulte';

// ----------------------------------------------------------- tuning ----
export const MIN_PLAYERS = 4;
export const HAND_SIZE = 7;
export const DEAL_MS = 7000; // the deal and the first pairs being thrown away, before the first turn
export const TURN_MS = 15000; // time to draw; too slow = a random card is drawn for you (not in the rules: tune here)
export const RESULT_MS = 3200; // what happened stays on screen before the next turn
export const ZAP_MS = 5500; // ...longer when somebody was eliminated
export const MAX_TURNS = 150; // safety cap: then the player holding the Joker wins

// ------------------------------------------------------------ cards ----
export type Card = string; // 'JK' (the Joker) or a rank and a suit, e.g. '7H', '10S', 'AC'
export const JOKER: Card = 'JK';
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export const SUITS = ['S', 'H', 'D', 'C'] as const; // spades, hearts, diamonds, clubs

export const isJoker = (c: Card) => c === JOKER;
export const rankOf = (c: Card) => (isJoker(c) ? 'JOKER' : c.slice(0, -1));
export const suitOf = (c: Card) => (isJoker(c) ? '' : c.slice(-1));
export const isRed = (c: Card) => suitOf(c) === 'H' || suitOf(c) === 'D';

const rankIndex = (c: Card) => (isJoker(c) ? 99 : RANKS.indexOf(rankOf(c) as (typeof RANKS)[number]));
// For showing a hand in order (the Joker last).
export const sortHand = (hand: Card[]) => hand.slice().sort((a, b) => rankIndex(a) - rankIndex(b) || a.localeCompare(b));

function shuffled<T>(items: readonly T[], rnd: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The pile for `n` players: HAND_SIZE x n cards, ONE Joker, and every other card has a partner (when the
// count is odd, which it is for an even n, exactly one card has none). Suits are only decoration, so a
// "pair" is two cards of the same number; for 8 players a number may appear up to 8 times.
export function buildDeck(n: number, seed: string): Card[] {
  const rnd = makeRng(`${seed}:oldmaid:deck`);
  const others = HAND_SIZE * n - 1;
  const pairs = Math.floor(others / 2);
  const slots = shuffled(
    RANKS.flatMap((r) => [r, r, r, r]),
    rnd
  ).slice(0, pairs);
  const cards: Card[] = [];
  for (const r of slots) {
    const [s1, s2] = shuffled(SUITS, rnd);
    cards.push(`${r}${s1}`, `${r}${s2}`);
  }
  if (others % 2 === 1) cards.push(`${RANKS[Math.floor(rnd() * RANKS.length)]}${SUITS[Math.floor(rnd() * 4)]}`);
  cards.push(JOKER);
  return shuffled(cards, rnd);
}

// Throw away every pair of cards with the same number. A number held three times leaves one card.
export function pairOff(hand: Card[]): { hand: Card[]; pairs: [Card, Card][] } {
  const pairs: [Card, Card][] = [];
  const waiting = new Map<string, number>(); // number -> position of a card waiting for its partner
  const gone = new Set<number>(); // positions thrown away
  hand.forEach((c, i) => {
    if (isJoker(c)) return;
    const r = rankOf(c);
    const w = waiting.get(r);
    if (w !== undefined) {
      pairs.push([hand[w], c]);
      gone.add(w).add(i);
      waiting.delete(r);
    } else waiting.set(r, i);
  });
  return { hand: hand.filter((_, i) => !gone.has(i)), pairs };
}

// ------------------------------------------------------------ state ----
export type Why = 'joker' | 'empty' | 'left';
export type Phase = 'dealing' | 'turn' | 'result' | 'over';

// What happened in one step, for the banner and the chairs.
export type Event = {
  n: number; // turn number
  kind: 'draw' | 'left';
  drawer: string | null;
  target: string | null; // who the card was taken from ('left': who got the Joker, if anybody)
  pair: [Card, Card] | null; // the pair the drawer threw away because of the drawn card
  joker: boolean; // the drawn card was the Joker
  auto: boolean; // nobody picked in time: a random card was drawn
  out: { uid: string; why: Why }[]; // players eliminated in this step
};

export type State = {
  ver: number; // goes up on every change (the host saves when it changes)
  rev: number; // goes up on every step of the game (moves are made for one rev)
  hv: number; // goes up whenever any hand changes (the host saves the hands when it changes)
  seed: string;
  order: string[]; // the circle, counterclockwise: the right neighbour of order[i] is order[i + 1]
  phase: Phase;
  out: Record<string, Why>; // eliminated players, and why
  counts: Record<string, number>; // public: how many cards each player holds
  discards: { by: string; cards: [Card, Card] }[]; // the pairs thrown away, face up in the middle
  current: string | null; // whose turn it is to draw
  target: string | null; // the player they draw from
  next: string | null; // who draws next (the first living player from here on)
  turn: number;
  last: Event | null;
  winner: string | null;
  cap: boolean; // the game ended by the turn cap
  endsAt: number; // when the running timer ends, in the HOST's clock (0 = none)
  remainingMs: number; // filled in when the state is saved, so every phone can count down
  // SECRET, host only (never saved in the shared state): uid -> the cards they hold.
  hands: Record<string, Card[]>;
};

export type Move = { uid: string; rev: number; kind: 'draw'; index: number };

const clone = (s: State): State => JSON.parse(JSON.stringify(s));
function edit(s: State): State {
  const c = clone(s);
  c.ver = s.ver + 1;
  return c;
}

export const aliveOf = (s: State) => s.order.filter((id) => !(id in s.out));
export const isAlive = (s: State, uid: string) => s.order.includes(uid) && !(uid in s.out);

// The next living player counterclockwise (the one you draw from).
export function rightOf(s: State, uid: string): string | null {
  const i = s.order.indexOf(uid);
  if (i < 0) return null;
  for (let k = 1; k < s.order.length; k++) {
    const c = s.order[(i + k) % s.order.length];
    if (isAlive(s, c)) return c;
  }
  return null;
}

// The next living player clockwise (the one who draws from you).
export function leftOf(s: State, uid: string): string | null {
  const i = s.order.indexOf(uid);
  if (i < 0) return null;
  for (let k = 1; k < s.order.length; k++) {
    const c = s.order[(i - k + s.order.length * 2) % s.order.length];
    if (isAlive(s, c)) return c;
  }
  return null;
}

export const jokerHolder = (s: State): string | null => aliveOf(s).find((id) => (s.hands[id] ?? []).includes(JOKER)) ?? null;

function syncCounts(s: State) {
  for (const id of s.order) s.counts[id] = (s.hands[id] ?? []).length;
  s.hv += 1;
}

export function newGame(order: string[], seed: string, now: number): State {
  const n = order.length;
  const deck = buildDeck(n, seed);
  const hands: Record<string, Card[]> = {};
  const discards: State['discards'] = [];
  order.forEach((id, i) => {
    const { hand, pairs } = pairOff(deck.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE));
    hands[id] = hand;
    for (const p of pairs) discards.push({ by: id, cards: p });
  });
  const rnd = makeRng(`${seed}:oldmaid:start`);
  const s: State = {
    ver: 1,
    rev: 0,
    hv: 0,
    seed,
    order: order.slice(),
    phase: 'dealing',
    out: {},
    counts: {},
    discards,
    current: null,
    target: null,
    next: order[Math.floor(rnd() * n)],
    turn: 0,
    last: null,
    winner: null,
    cap: false,
    endsAt: now + DEAL_MS,
    remainingMs: DEAL_MS,
    hands,
  };
  syncCounts(s);
  return s;
}

// What is saved for everybody: the state without the secret hands.
export const publicState = (s: State): State => ({ ...s, hands: {} });

// Host restart: put the secret hands back into a saved state (from the hand documents).
export function withHands(s: State, hands: Record<string, Card[]>): State {
  const c = clone(s);
  c.hands = {};
  for (const id of c.order) c.hands[id] = id in c.out ? [] : (hands[id] ?? []).slice();
  return c;
}

function endGame(s: State, cap = false) {
  const alive = aliveOf(s);
  s.phase = 'over';
  s.cap = cap;
  // The last player alive holds the Joker; at the turn cap, whoever holds it clears the game.
  s.winner = alive.length === 1 ? alive[0] : jokerHolder(s);
  s.current = null;
  s.target = null;
  s.endsAt = 0;
  s.rev += 1;
}

// The next turn: the first living player from `next` draws from the player on their right.
function startTurn(s: State, now: number) {
  if (aliveOf(s).length <= 1) return endGame(s);
  if (s.turn >= MAX_TURNS) return endGame(s, true);
  const n = s.order.length;
  const from = Math.max(0, s.order.indexOf(s.next ?? s.order[0]));
  for (let k = 0; k < n; k++) {
    const id = s.order[(from + k) % n];
    if (!isAlive(s, id)) continue;
    const target = rightOf(s, id);
    if (!target) break;
    s.current = id;
    s.target = target;
    s.turn += 1;
    // The target shuffles their hand before every draw, so where a card lies tells you nothing.
    s.hands[target] = shuffled(s.hands[target], makeRng(`${s.seed}:shuf:${s.turn}`));
    s.phase = 'turn';
    s.endsAt = now + TURN_MS;
    s.rev += 1;
    return;
  }
  endGame(s);
}

function eliminate(s: State, uid: string, why: Why, ev: Event) {
  s.out[uid] = why;
  s.hands[uid] = []; // their cards leave the game
  ev.out.push({ uid, why });
}

// `index`-th card of the target's hand goes to the current player.
function doDraw(s: State, index: number, auto: boolean, now: number) {
  const d = s.current!;
  const t = s.target!;
  const card = s.hands[t].splice(index, 1)[0];
  s.hands[d].push(card);
  const ev: Event = { n: s.turn, kind: 'draw', drawer: d, target: t, pair: null, joker: isJoker(card), auto, out: [] };

  if (isJoker(card)) {
    // The Joker is drawn from them: they are electrocuted.
    eliminate(s, t, 'joker', ev);
  } else {
    const r = rankOf(card);
    const other = s.hands[d].findIndex((c, i) => !isJoker(c) && rankOf(c) === r && i !== s.hands[d].length - 1);
    if (other >= 0) {
      const mate = s.hands[d].splice(other, 1)[0];
      s.hands[d].pop(); // the drawn card was the last one added
      ev.pair = [mate, card];
      s.discards.push({ by: d, cards: [mate, card] });
    }
    if (s.hands[t].length === 0) eliminate(s, t, 'empty', ev); // the last card was drawn from them
    if (s.hands[d].length === 0) eliminate(s, d, 'empty', ev); // they threw away their last card
  }

  syncCounts(s);
  s.last = ev;
  s.next = t; // the one drawn from draws next (startTurn skips them if they are out)
  s.phase = 'result';
  s.endsAt = now + (ev.out.length > 0 ? ZAP_MS : RESULT_MS);
  s.rev += 1;
}

// ------------------------------------------------------------ moves ----
export function apply(state: State, move: Move, now: number): State {
  if (state.phase !== 'turn' || move.kind !== 'draw') return state;
  if (move.uid !== state.current || move.rev !== state.rev) return state;
  const size = (state.hands[state.target ?? ''] ?? []).length;
  if (!Number.isInteger(move.index) || move.index < 0 || move.index >= size) return state;
  const s = edit(state);
  doDraw(s, move.index, false, now);
  return s;
}

// ----------------------------------------------------------- timers ----
// A player who left the game is out at once (electrocuted). If they held the Joker it goes to the player
// who would have drawn from them, so it always stays in a living hand.
function dropPlayer(state: State, uid: string, now: number): State {
  const s = edit(state);
  const holds = s.hands[uid].includes(JOKER);
  const wasCurrent = s.current === uid;
  const wasTarget = s.target === uid;
  const heir = holds ? leftOf(s, uid) : null;
  const rightNeighbour = rightOf(s, uid);
  const ev: Event = { n: s.turn, kind: 'left', drawer: uid, target: heir, pair: null, joker: holds, auto: false, out: [] };
  eliminate(s, uid, 'left', ev);
  if (heir) s.hands[heir].push(JOKER);
  syncCounts(s);
  if (s.phase === 'over') return state;

  if (s.phase === 'result' && s.last) s.last = { ...s.last, out: [...s.last.out, ...ev.out] };
  else s.last = ev;

  if (aliveOf(s).length <= 1) {
    endGame(s);
    return s;
  }
  if (s.phase === 'turn') {
    if (wasCurrent) {
      s.next = rightNeighbour;
      startTurn(s, now); // the cancelled turn is replaced by a new one
    } else if (wasTarget) {
      s.target = rightOf(s, s.current!);
      s.hands[s.target!] = shuffled(s.hands[s.target!], makeRng(`${s.seed}:shuf:${s.turn}:t`));
      s.rev += 1; // moves made for the old target are void
    }
  }
  return s;
}

// Call a few times per second on the host. `left` = players who forfeited the game.
export function tick(state: State, now: number, left: string[] = []): State {
  if (state.phase === 'over') return state;
  // Once only one player is left alive the game is decided (the result is still on screen), so a late
  // forfeit changes nothing.
  if (aliveOf(state).length > 1) for (const id of left) if (isAlive(state, id)) return dropPlayer(state, id, now);
  if (state.endsAt === 0 || now < state.endsAt) return state;

  const s = edit(state);
  switch (state.phase) {
    case 'dealing':
      startTurn(s, now);
      break;
    case 'turn': {
      // Too slow: a random card is drawn for them.
      const size = s.hands[s.target!].length;
      const index = Math.floor(makeRng(`${s.seed}:auto:${s.turn}`)() * size);
      doDraw(s, Math.min(size - 1, index), true, now);
      break;
    }
    case 'result':
      startTurn(s, now);
      break;
  }
  return s;
}

export const remainingNow = (state: State, receivedAt: number, now: number) =>
  Math.max(0, state.remainingMs - (now - receivedAt));

// ----------------------------------------------------- game screens ----
// Where does a player sit on MY screen? I sit at the bottom; the circle runs counterclockwise from me, so the
// player on my right is the first seat after mine on the right-hand side. Returns the seat index relative to me.
export const seatOffset = (s: State, me: string, uid: string): number => {
  const n = s.order.length;
  const a = s.order.indexOf(me);
  const b = s.order.indexOf(uid);
  return a < 0 || b < 0 ? 0 : (b - a + n) % n;
};

// The winner is whoever finished holding the Joker. (Only the winner reports finished: true.)
export { pickWinner } from './schulte';
