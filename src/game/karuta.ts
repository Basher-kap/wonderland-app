// Karuta: pure rules, no React, no Firebase.
//
// 26 letter cards (A-Z) are dealt equally to the players (floor(26 / players) each). The cards left
// over are VOID cards: they are out of play (nobody holds them and they are never the target).
// Everybody's rack is visible to everybody.
//
//   1. MEMORIZE: 45 seconds to remember the other players' racks.
//   2. WAITING: a random time (WAIT_MIN_MS..WAIT_MAX_MS, within 15 s) before the floating target
//      card appears. Players may already grab a card in advance (one grab per target). Advance
//      grabs are secret and are judged only when the target is revealed: a wrong guess is a
//      penalty (you receive that card from its owner), a lucky correct guess counts as a correct grab.
//   3. LIVE: the target card is shown. Everybody may grab ONE card (from any rack, own included).
//        - the right card: it leaves the game. If it came from ANOTHER player's rack, the one who
//          took it must send one of their own cards to that player (GIVE phase, time paused).
//        - a wrong card: the grabber RECEIVES that card (it leaves its owner's rack and joins the
//          grabber's rack). Grabbing a wrong card of your own rack changes nothing, but it is your
//          one grab for this target.
//      Nobody takes the target in LIVE_MS: it disappears and the next waiting time starts.
//   4. The first player with an empty rack clears the game and wins.
//
// The game is a small state machine, like Battleships and Fortune. The HOST's phone is the only
// one that runs it: players send "moves" (grab / give) and the host applies them with `apply`, and
// calls `tick` a few times per second for the timers. Moves carry the number of the target they
// were made for (`rev` = state.targetNo), so an old or repeated move is ignored.
//
// SECRET: the advance grabs (`advance`) are NOT part of the state saved for everybody
// (`publicState` strips them). The host keeps them in memory and can rebuild them from the moves
// (`withAdvance`) if its phone restarts. Everybody only sees WHO has already grabbed (`advanced`).
import { makeRng } from './schulte';

// ----------------------------------------------------------- tuning ----
export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const MEMORIZE_MS = 45000; // time to memorize the racks
export const WAIT_MIN_MS = 3000; // the target appears after a random time between these two
export const WAIT_MAX_MS = 15000; // ("within 15 seconds")
export const LIVE_MS = 8000; // the target stays this long if nobody takes it (not stated in the rules: tune here)
export const GIVE_MS = 10000; // time to choose the card to send (time is paused meanwhile)
export const MAX_GAME_MS = 10 * 60 * 1000; // safety cap (not stated in the rules): then the fewest cards wins

export type Phase = 'memorize' | 'waiting' | 'live' | 'giving' | 'over';

// took   = the target was taken correctly (by `by`, from `owner`'s rack)
// wrong  = `by` grabbed a wrong card `card` of `owner`'s rack (received it, unless own)
// gave   = `by` sent `card` to `owner` (the penalty after a correct grab)
// nobody = nobody took the target in time
// forfeit= `by` left the game
export type EventKind = 'took' | 'wrong' | 'gave' | 'nobody' | 'forfeit';
export type KarutaEvent = {
  n: number;
  kind: EventKind;
  by: string;
  owner?: string;
  card?: string;
  own?: boolean; // wrong: the card was in the grabber's own rack (nothing moves)
  auto?: boolean; // gave: chosen by the host because time ran out
  advance?: boolean; // took / wrong: it was an advance grab
};

export type State = {
  ver: number; // goes up on every change (the host saves when it changes)
  seed: string;
  order: string[]; // everybody, fixed order for the screen
  phase: Phase;
  racks: Record<string, string[]>; // public: the cards of each player (in the order they sit on the rack)
  voidCards: string[]; // the cards left over by the deal
  taken: string[]; // cards taken out of play (correct grabs, forfeited racks)
  out: string[]; // players who forfeited the game
  targetNo: number; // number of the current target, 0 = still memorizing; goes up when WAITING starts
  target: string | null; // the floating target card (only in LIVE and GIVING)
  spot: { x: number; y: number } | null; // where it floats (fractions of the board, 0..1)
  tried: string[]; // players who already used their grab for this target
  advanced: string[]; // players who grabbed in advance for the next target (their pick is secret)
  giver: string | null; // GIVING: who sends a card
  giveTo: string | null; // GIVING: who receives it
  events: KarutaEvent[]; // the last few things that happened
  eventNo: number;
  winner: string | null;
  endsAt: number; // when the running timer ends, in the HOST's clock (0 = none)
  remainingMs: number; // filled in when the state is saved, so every phone can count down
  deadline: number; // the safety cap, in the HOST's clock
  // SECRET, host only (never saved): uid -> the advance grab for the current target.
  advance: Record<string, { owner: string; card: string; at: number }>;
};

export type Move = { uid: string; rev: number; kind: 'grab' | 'give'; owner?: string; card?: string; at?: number };

// ------------------------------------------------------------- deal ----
function shuffled<T>(items: readonly T[], rnd: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function shuffleOrder(playerIds: string[], seed: string): string[] {
  return shuffled(playerIds, makeRng(`${seed}:order`));
}

export const cardsPerPlayer = (players: number) => Math.floor(LETTERS.length / Math.max(1, players));

// Equal racks for everybody; the remainder is void.
export function deal(order: string[], seed: string): { racks: Record<string, string[]>; voidCards: string[] } {
  const deck = shuffled(LETTERS, makeRng(`${seed}:deal`));
  const per = cardsPerPlayer(order.length);
  const racks: Record<string, string[]> = {};
  order.forEach((id, i) => {
    racks[id] = deck.slice(i * per, (i + 1) * per);
  });
  return { racks, voidCards: deck.slice(order.length * per) };
}

// ------------------------------------------------------------ state ----
function edit(s: State): State {
  const c: State = JSON.parse(JSON.stringify(s));
  c.ver = s.ver + 1;
  return c;
}

export const activePlayers = (s: State) => s.order.filter((id) => !s.out.includes(id));

export function newGame(order: string[], seed: string, now: number): State {
  const { racks, voidCards } = deal(order, seed);
  return {
    ver: 1,
    seed,
    order: order.slice(),
    phase: 'memorize',
    racks,
    voidCards,
    taken: [],
    out: [],
    targetNo: 0,
    target: null,
    spot: null,
    tried: [],
    advanced: [],
    giver: null,
    giveTo: null,
    events: [],
    eventNo: 0,
    winner: null,
    endsAt: now + MEMORIZE_MS,
    remainingMs: MEMORIZE_MS,
    deadline: now + MEMORIZE_MS + MAX_GAME_MS,
    advance: {},
  };
}

// What is saved for everybody: the state without the secret advance grabs.
export function publicState(s: State): State {
  return { ...s, advance: {} };
}

// Host restart: put the secret advance grabs back into a saved state, from the grab moves that are
// still in the lobby (the first one of each player for this target) while the target is not out yet.
export function withAdvance(s: State, moves: Move[]): State {
  const c: State = JSON.parse(JSON.stringify(s));
  c.advance = {};
  if (c.phase !== 'waiting') return c;
  const mine = moves
    .filter((m) => m.kind === 'grab' && m.rev === c.targetNo && c.advanced.includes(m.uid))
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  for (const m of mine) {
    if (c.advance[m.uid] || !m.owner || !m.card || !c.racks[m.owner]?.includes(m.card)) continue;
    c.advance[m.uid] = { owner: m.owner, card: m.card, at: m.at ?? 0 };
  }
  return c;
}

// Every card still on a rack of a player who is in the game.
export const cardsInPlay = (s: State) => activePlayers(s).flatMap((id) => s.racks[id]);

// The next target: a card that is on somebody's rack (never a void card). The same on every call
// while the racks do not change (they do not change while WAITING).
export function chooseTarget(s: State): string | null {
  const pool = cardsInPlay(s);
  if (pool.length === 0) return null;
  const rnd = makeRng(`${s.seed}:target:${s.targetNo}`);
  return pool[Math.floor(rnd() * pool.length)];
}

const addEvent = (s: State, e: Omit<KarutaEvent, 'n'>) => {
  s.eventNo += 1;
  s.events.push({ n: s.eventNo, ...e });
  if (s.events.length > 8) s.events.shift();
};

const validPick = (s: State, owner: unknown, card: unknown): owner is string =>
  typeof owner === 'string' &&
  typeof card === 'string' &&
  s.order.includes(owner) &&
  !s.out.includes(owner) &&
  (s.racks[owner] ?? []).includes(card);

// ---------------------------------------------------------- helpers ----
function endGame(s: State, winner: string | null) {
  s.phase = 'over';
  s.winner = winner;
  s.giver = null;
  s.giveTo = null;
  s.endsAt = 0;
}

// The first player (still in the game) with an empty rack.
const emptied = (s: State): string | null => activePlayers(s).find((id) => s.racks[id].length === 0) ?? null;

// The safety cap: the fewest cards wins, a tie for the top is a draw.
function endByCount(s: State) {
  const a = activePlayers(s);
  if (a.length === 0) return endGame(s, null);
  const fewest = Math.min(...a.map((id) => s.racks[id].length));
  const best = a.filter((id) => s.racks[id].length === fewest);
  endGame(s, best.length === 1 ? best[0] : null);
}

function startWaiting(s: State, now: number) {
  s.targetNo += 1;
  s.target = null;
  s.spot = null;
  s.tried = [];
  s.advanced = [];
  s.advance = {};
  s.giver = null;
  s.giveTo = null;
  s.phase = 'waiting';
  const rnd = makeRng(`${s.seed}:delay:${s.targetNo}`);
  s.endsAt = now + WAIT_MIN_MS + Math.floor(rnd() * (WAIT_MAX_MS - WAIT_MIN_MS));
}

// The action (a take, with its give) is complete: somebody may have cleared the game, else go on.
function afterAction(s: State, now: number) {
  const w = emptied(s);
  if (w) return endGame(s, w);
  if (activePlayers(s).length <= 1) return endGame(s, activePlayers(s)[0] ?? null);
  startWaiting(s, now);
}

function moveCard(s: State, from: string, to: string, card: string) {
  s.racks[from] = s.racks[from].filter((c) => c !== card);
  s.racks[to].push(card);
}

// A wrong grab: the grabber receives the card (grabbing a wrong card of their own rack changes nothing).
function wrongGrab(s: State, uid: string, owner: string, card: string, advance: boolean) {
  if (owner !== uid) moveCard(s, owner, uid, card);
  addEvent(s, { kind: 'wrong', by: uid, owner, card, own: owner === uid, advance });
}

// A correct grab: the target leaves the game. From somebody else's rack: its taker now sends one of
// their own cards to that player (the clock stops while they choose).
function takeTarget(s: State, uid: string, owner: string, card: string, advance: boolean, now: number) {
  s.racks[owner] = s.racks[owner].filter((c) => c !== card);
  s.taken.push(card);
  s.target = card;
  addEvent(s, { kind: 'took', by: uid, owner, card, advance });
  const w = owner !== uid && !s.out.includes(owner) && s.racks[uid].length > 0;
  if (w) {
    s.phase = 'giving';
    s.giver = uid;
    s.giveTo = owner;
    s.endsAt = now + GIVE_MS;
    return;
  }
  afterAction(s, now);
}

function give(s: State, uid: string, card: string, auto: boolean, now: number) {
  const to = s.giveTo as string;
  moveCard(s, uid, to, card);
  addEvent(s, { kind: 'gave', by: uid, owner: to, card, auto });
  afterAction(s, now);
}

// The target appears. The advance grabs are judged now, oldest first.
function reveal(s: State, now: number) {
  const target = chooseTarget(s);
  if (!target) return endByCount(s);
  s.target = target;
  s.phase = 'live';
  s.endsAt = now + LIVE_MS;
  const rnd = makeRng(`${s.seed}:spot:${s.targetNo}`);
  s.spot = { x: 0.2 + rnd() * 0.6, y: 0.04 + rnd() * 0.5 };

  const picks = Object.entries(s.advance)
    .map(([uid, p]) => ({ uid, ...p }))
    .sort((a, b) => a.at - b.at);
  s.tried = Array.from(new Set([...s.tried, ...picks.map((p) => p.uid)]));
  s.advance = {};

  let lucky: (typeof picks)[number] | null = null;
  for (const p of picks) {
    if (s.out.includes(p.uid) || !(s.racks[p.owner] ?? []).includes(p.card)) continue;
    if (p.card === target) {
      if (!lucky) lucky = p; // the first lucky guess; later ones are simply too late
      continue;
    }
    wrongGrab(s, p.uid, p.owner, p.card, true);
    const w = emptied(s);
    if (w) return endGame(s, w);
  }
  if (lucky) takeTarget(s, lucky.uid, lucky.owner, lucky.card, true, now);
}

// ------------------------------------------------------------ moves ----
export function apply(state: State, move: Move, now: number): State {
  if (state.phase === 'over' || !state.order.includes(move.uid) || state.out.includes(move.uid)) return state;

  if (move.kind === 'grab') {
    if (move.rev !== state.targetNo) return state;
    if (!validPick(state, move.owner, move.card)) return state;
    const owner = move.owner as string;
    const card = move.card as string;

    if (state.phase === 'waiting') {
      if (state.advanced.includes(move.uid)) return state; // one grab per target
      const s = edit(state);
      s.advanced.push(move.uid);
      s.advance[move.uid] = { owner, card, at: move.at ?? now };
      return s;
    }
    if (state.phase === 'live') {
      if (state.tried.includes(move.uid)) return state;
      const s = edit(state);
      s.tried.push(move.uid);
      if (card === s.target) {
        takeTarget(s, move.uid, owner, card, false, now);
      } else {
        wrongGrab(s, move.uid, owner, card, false);
        const w = emptied(s);
        if (w) endGame(s, w);
      }
      return s;
    }
    return state;
  }

  // give: only the player who has to send a card, and only a card of their own rack
  if (state.phase !== 'giving' || move.uid !== state.giver || move.rev !== state.targetNo) return state;
  if (typeof move.card !== 'string' || !state.racks[move.uid].includes(move.card)) return state;
  const s = edit(state);
  give(s, move.uid, move.card, false, now);
  return s;
}

// ----------------------------------------------------------- timers ----
// A player who forfeited the game is out at once: their cards leave the game.
function dropPlayer(state: State, uid: string, now: number): State {
  const s = edit(state);
  s.out.push(uid);
  s.taken.push(...s.racks[uid]);
  s.racks[uid] = [];
  delete s.advance[uid];
  s.advanced = s.advanced.filter((id) => id !== uid);
  addEvent(s, { kind: 'forfeit', by: uid });
  if (s.phase === 'over') return s;
  if (activePlayers(s).length <= 1) {
    endGame(s, activePlayers(s)[0] ?? null);
    return s;
  }
  // Nobody to send to / nobody to send: the give is cancelled.
  if (s.phase === 'giving' && (s.giver === uid || s.giveTo === uid)) {
    afterAction(s, now);
    return s;
  }
  // The target was on the rack of the player who left: it is gone, so the next one starts.
  if (s.phase === 'live' && s.target && !cardsInPlay(s).includes(s.target)) startWaiting(s, now);
  return s;
}

// Call a few times per second on the host. `left` = players who forfeited the game.
export function tick(state: State, now: number, left: string[] = []): State {
  if (state.phase === 'over') return state;
  for (const id of left) if (state.order.includes(id) && !state.out.includes(id)) return dropPlayer(state, id, now);

  if (now >= state.deadline && state.phase !== 'giving') {
    const s = edit(state);
    endByCount(s);
    return s;
  }
  if (state.endsAt === 0 || now < state.endsAt) return state;

  const s = edit(state);
  switch (state.phase) {
    case 'memorize':
      startWaiting(s, now);
      break;
    case 'waiting':
      reveal(s, now);
      break;
    case 'live':
      addEvent(s, { kind: 'nobody', by: '' });
      startWaiting(s, now);
      break;
    case 'giving': {
      // Too slow: the host sends a random card for them.
      const rack = s.racks[s.giver as string];
      const card = rack[Math.floor(makeRng(`${s.seed}:give:${s.targetNo}`)() * rack.length)];
      give(s, s.giver as string, card, true, now);
      break;
    }
  }
  return s;
}

export const remainingNow = (state: State, receivedAt: number, now: number) =>
  Math.max(0, state.remainingMs - (now - receivedAt));
