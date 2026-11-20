// Fortune: pure rules, no React, no Firebase.
//
// Every player starts with GAME_LIVES life (this is NOT the lobby's 10 lives). A small temple
// picks a player at random; that player draws one of the 100 covered fortune slips, reads the
// fortune and answers the numerical question on it. A wrong answer costs life depending on how far
// off the answer is and on the luck of the slip, and part of that loss splashes on the other
// players. A right answer recovers a little life on lucky slips. The last player alive wins.
//
// The game is a small state machine, like Magical Banana. The HOST's phone is the only one that
// runs it: players send "moves" (open the temple, pick a slip, answer) and the host applies them
// with `apply`, and calls `tick` a few times per second for the timers. Every phone shows the
// state the host saves. A move carries the `rev` of the state it was made for, and `rev` only goes
// up, so an old or repeated move is ignored.
//
// The 100 slips are the same on every phone: they come from the round's seed (`buildDeck`), so
// the state only has to remember which slip numbers were already taken.
import { FORTUNE_BANKS } from '../data/fortune';
import type { FortuneQuestion, FortuneTier, TierBank } from '../data/fortune';
import { makeRng } from './schulte';

export { FORTUNE_BANKS };
export type { FortuneTier };

// ----------------------------------------------------------- tuning ----
export const GAME_LIVES = 250;
export const DECK_SIZE = 100;
export const PICK_MS = 10000; // time to pick a slip once the pane is open; too slow = lose 25
export const PICK_PENALTY = 25;
export const TEMPLE_MS = 10000; // the chosen player should tap the temple; after this it opens by itself
export const CHOOSING_MS = 3500; // the temple "choosing" a player
export const ANSWER_MS = 45000;
export const REVEAL_MS = 9000; // the slip, the answer and the life lost stay on screen
export const MAX_GUESS = 999999999999; // 12 digits

// true = the rules as written: splash can take the other players to 0, so one bad answer can wipe out
// everybody at once (then nobody wins: a draw). With the Daikyou-only deck about 6 games in 10 end
// that way; with all tiers about 2-4 in 10. false = splash stops at 1 life, so only a player's own
// wrong answers can kill them and there is always a last player alive.
export const SPLASH_CAN_KILL = true;

export type TierRule = {
  label: string;
  kanji: string;
  heal: number; // life recovered by a right answer
  min: number; // life lost when the answer is wrong but (almost) right
  max: number; // life lost when the answer is at least 100% off
  splash: number; // share of the loss that is shared among the other players
  auto: boolean; // Daikichi: a bonus slip with no question, always "correct"
};

// Repeated by the tier files' own numbers (checked by the tests): change both together.
export const TIERS: Record<FortuneTier, TierRule> = {
  daikichi: { label: 'Daikichi', kanji: '大吉', heal: 20, min: 0, max: 0, splash: 0, auto: true },
  chuukichi: { label: 'Chuukichi', kanji: '中吉', heal: 10, min: 20, max: 35, splash: 0.15, auto: false },
  shokichi: { label: 'Shokichi', kanji: '小吉', heal: 5, min: 20, max: 45, splash: 0.25, auto: false },
  kichi: { label: 'Kichi', kanji: '吉', heal: 0, min: 20, max: 55, splash: 0.4, auto: false },
  kyou: { label: 'Kyou', kanji: '凶', heal: 0, min: 20, max: 70, splash: 0.6, auto: false },
  daikyou: { label: 'Daikyou', kanji: '大凶', heal: 0, min: 50, max: 90, splash: 0.85, auto: false },
};

export const TIER_ORDER: FortuneTier[] = ['daikichi', 'chuukichi', 'shokichi', 'kichi', 'kyou', 'daikyou'];

// How many of the 100 slips belong to each tier.
export const DECK_COMPOSITION: Record<FortuneTier, number> = {
  daikichi: 1,
  chuukichi: 29,
  shokichi: 20,
  kichi: 20,
  kyou: 29,
  daikyou: 1,
};

// ------------------------------------------------------------- deck ----
export type Slip = { tier: FortuneTier; qid: string };

const hasQuestions = (banks: Partial<Record<FortuneTier, TierBank>>, t: FortuneTier) =>
  (banks[t]?.questions.length ?? 0) > 0;

// Slips per tier. A tier with no questions (its file was not added yet) hands its slips to the
// tiers that have questions, in proportion to their share, so the deck is always 100 slips.
export function deckCounts(
  banks: Partial<Record<FortuneTier, TierBank>> = FORTUNE_BANKS
): Record<FortuneTier, number> {
  const counts: Record<FortuneTier, number> = { ...DECK_COMPOSITION };
  const have = TIER_ORDER.filter((t) => hasQuestions(banks, t));
  if (have.length === 0) throw new Error('Fortune has no questions at all.');
  const spare = TIER_ORDER.filter((t) => !have.includes(t)).reduce((n, t) => n + DECK_COMPOSITION[t], 0);
  for (const t of TIER_ORDER) if (!have.includes(t)) counts[t] = 0;
  if (spare === 0) return counts;
  const base = have.reduce((n, t) => n + DECK_COMPOSITION[t], 0);
  const shares = have.map((t) => ({ t, exact: (DECK_COMPOSITION[t] / base) * spare }));
  let given = 0;
  for (const s of shares) {
    const whole = Math.floor(s.exact);
    counts[s.t] += whole;
    given += whole;
  }
  // The rest, one by one, to the biggest remainders (ties: the earlier tier).
  const byRemainder = shares
    .map((s, i) => ({ ...s, frac: s.exact - Math.floor(s.exact), i }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; given < spare; k++, given++) counts[byRemainder[k % byRemainder.length].t] += 1;
  return counts;
}

function shuffled<T>(items: readonly T[], rnd: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The 100 slips of a round, in slip-number order. Same seed = same deck on every phone. Inside one
// game a question is not repeated unless a tier needs more slips than it has questions.
export function buildDeck(
  seed: string,
  banks: Partial<Record<FortuneTier, TierBank>> = FORTUNE_BANKS
): Slip[] {
  const counts = deckCounts(banks);
  const tiers: FortuneTier[] = [];
  for (const t of TIER_ORDER) for (let i = 0; i < counts[t]; i++) tiers.push(t);
  const order = shuffled(tiers, makeRng(`${seed}:deck`));
  const pools: Partial<Record<FortuneTier, string[]>> = {};
  const used: Partial<Record<FortuneTier, number>> = {};
  return order.map((tier) => {
    if (!pools[tier]) {
      pools[tier] = shuffled(banks[tier]!.questions.map((q) => q.id), makeRng(`${seed}:pool:${tier}`));
      used[tier] = 0;
    }
    const pool = pools[tier]!;
    const n = used[tier]!;
    used[tier] = n + 1;
    return { tier, qid: pool[n % pool.length] };
  });
}

const deckCache = new Map<string, Slip[]>();
export function deckFor(seed: string): Slip[] {
  let d = deckCache.get(seed);
  if (!d) {
    if (deckCache.size > 20) deckCache.clear();
    d = buildDeck(seed);
    deckCache.set(seed, d);
  }
  return d;
}

export function questionOf(slip: Slip, banks: Partial<Record<FortuneTier, TierBank>> = FORTUNE_BANKS): FortuneQuestion {
  const q = banks[slip.tier]?.questions.find((x) => x.id === slip.qid);
  if (!q) throw new Error(`Unknown fortune question ${slip.qid}`);
  return q;
}

// ------------------------------------------------------- life maths ----
// Relative error, 0 (exact) to 1 (100% off or more).
export const errorRatio = (answer: number, guess: number) =>
  Math.min(1, Math.abs(answer - guess) / Math.max(1, answer));

// "Correct" means exactly right. (Nothing is rounded: a near miss is wrong, it just costs less.)
export const isCorrect = (answer: number, guess: number) => guess === answer;

// Life the answering player loses for a wrong answer.
export const selfLoss = (tier: FortuneTier, error: number) =>
  Math.round(TIERS[tier].min + (TIERS[tier].max - TIERS[tier].min) * error);

// Life EACH other living player loses. `aliveCount` includes the answering player.
export const splashEach = (tier: FortuneTier, loss: number, aliveCount: number) =>
  aliveCount <= 1 ? 0 : Math.floor((loss * TIERS[tier].splash) / (aliveCount - 1));

// The typed text as a number: digits only, at most 12 of them. null = nothing usable.
export function cleanGuess(raw: unknown): number | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const digits = String(raw).replace(/\D/g, '').slice(0, 12);
  if (!digits) return null;
  return Number(digits);
}

export const isValidGuess = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_GUESS;

export const formatNumber = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ------------------------------------------------------------ state ----
export type Phase = 'choosing' | 'temple' | 'pick' | 'answer' | 'reveal' | 'over';

// What happened to the slip, for the reveal.
export type Result = {
  kind: 'daikichi' | 'correct' | 'wrong' | 'no-answer' | 'no-draw';
  uid: string;
  tier: FortuneTier | null; // null = no slip was drawn
  guess: number | null;
  answer: number | null;
  error: number; // 0-1
  loss: number; // life the player lost
  heal: number; // life the player recovered
  splash: Record<string, number>; // life each OTHER player lost (only those who lost some)
  died: string[]; // everybody who reached 0 life by this
};

export type State = {
  ver: number; // goes up on every change (the host saves when it changes)
  rev: number; // goes up on every step of the game (moves are made for one rev)
  seed: string;
  order: string[]; // everybody, fixed order for the screen
  alive: string[];
  lives: Record<string, number>;
  bag: string[]; // players the temple has not chosen yet in this round of choosing
  cycle: number; // how many times the bag was refilled
  taken: number[]; // slip numbers already drawn
  turn: number; // turns started so far
  current: string | null; // the chosen player
  slip: number | null; // the slip drawn this turn
  result: Result | null;
  phase: Phase;
  lastLeft: string | null; // the last player who left (forfeited)
  winner: string | null;
  endsAt: number; // when the running timer ends, in the HOST's clock (0 = none)
  remainingMs: number; // filled in when the state is saved, so every phone can count down
};

export type Move = { uid: string; rev: number; kind: 'open' | 'pick' | 'answer'; slip?: number; guess?: number };

export function shuffleOrder(playerIds: string[], seed: string): string[] {
  return shuffled(playerIds, makeRng(`${seed}:order`));
}

function edit(s: State): State {
  const c: State = JSON.parse(JSON.stringify(s));
  c.ver = s.ver + 1;
  return c;
}

// The temple chooses the next player: everybody once (in random order) before anybody twice.
// The same player never gets two turns in a row when somebody else is alive.
function startTurn(s: State, now: number) {
  if (s.bag.length === 0) {
    s.bag = shuffled(s.alive, makeRng(`${s.seed}:bag:${s.cycle}`));
    s.cycle += 1;
    if (s.alive.length > 1 && s.bag[0] === s.current) [s.bag[0], s.bag[1]] = [s.bag[1], s.bag[0]];
  }
  s.current = s.bag.shift()!;
  s.slip = null;
  s.result = null;
  s.turn += 1;
  s.phase = 'choosing';
  s.endsAt = now + CHOOSING_MS;
  s.rev += 1;
}

export function newGame(order: string[], seed: string, now: number): State {
  const s: State = {
    ver: 1,
    rev: 0,
    seed,
    order: order.slice(),
    alive: order.slice(),
    lives: Object.fromEntries(order.map((id) => [id, GAME_LIVES])),
    bag: [],
    cycle: 0,
    taken: [],
    turn: 0,
    current: null,
    slip: null,
    result: null,
    phase: 'choosing',
    lastLeft: null,
    winner: null,
    endsAt: 0,
    remainingMs: 0,
  };
  startTurn(s, now);
  s.remainingMs = CHOOSING_MS;
  return s;
}

// Who wins: the only player alive; if the slips ran out, the one with the most life (a tie, or
// nobody alive, is nobody's win).
function leader(s: State): string | null {
  if (s.alive.length === 0) return null;
  if (s.alive.length === 1) return s.alive[0];
  const best = Math.max(...s.alive.map((id) => s.lives[id]));
  const top = s.alive.filter((id) => s.lives[id] === best);
  return top.length === 1 ? top[0] : null;
}

function endGame(s: State) {
  s.phase = 'over';
  s.winner = leader(s);
  s.endsAt = 0;
  s.rev += 1;
}

// Take life off / give life back, drop the players who reached 0, and show the result.
function settle(s: State, r: Result, now: number) {
  const before = new Set(s.alive);
  s.lives[r.uid] = Math.max(0, Math.min(GAME_LIVES, s.lives[r.uid] + r.heal - r.loss));
  for (const [id, d] of Object.entries(r.splash)) s.lives[id] = Math.max(0, s.lives[id] - d);
  r.died = s.alive.filter((id) => s.lives[id] === 0 && before.has(id));
  s.alive = s.alive.filter((id) => s.lives[id] > 0);
  s.bag = s.bag.filter((id) => s.alive.includes(id));
  s.result = r;
  s.phase = 'reveal';
  s.endsAt = now + REVEAL_MS;
  s.rev += 1;
}

const emptyResult = (uid: string): Result => ({
  kind: 'no-draw',
  uid,
  tier: null,
  guess: null,
  answer: null,
  error: 0,
  loss: 0,
  heal: 0,
  splash: {},
  died: [],
});

// The player did not draw in time: -25 life, nothing splashes.
function noDraw(s: State, now: number) {
  settle(s, { ...emptyResult(s.current!), loss: PICK_PENALTY }, now);
}

// The slip's question was answered (guess) or the time ran out (guess = null).
function answerSlip(s: State, guess: number | null, now: number) {
  const slip = deckFor(s.seed)[s.slip!];
  const uid = s.current!;
  const rule = TIERS[slip.tier];
  const q = questionOf(slip);
  const base = { ...emptyResult(uid), tier: slip.tier, guess };

  if (rule.auto) {
    settle(s, { ...base, kind: 'daikichi', heal: rule.heal }, now);
    return;
  }
  const answer = q.a as number;
  if (guess !== null && isCorrect(answer, guess)) {
    settle(s, { ...base, kind: 'correct', answer, heal: rule.heal }, now);
    return;
  }
  const error = guess === null ? 1 : errorRatio(answer, guess);
  const loss = selfLoss(slip.tier, error);
  const each = splashEach(slip.tier, loss, s.alive.length);
  const splash: Record<string, number> = {};
  for (const id of s.alive) {
    if (id === uid) continue;
    const d = SPLASH_CAN_KILL ? each : Math.min(each, s.lives[id] - 1);
    if (d > 0) splash[id] = d;
  }
  settle(s, { ...base, kind: guess === null ? 'no-answer' : 'wrong', answer, error, loss, splash }, now);
}

function nextTurn(s: State, now: number) {
  if (s.alive.length <= 1 || s.taken.length >= DECK_SIZE) endGame(s);
  else startTurn(s, now);
}

// ------------------------------------------------------------ moves ----
export function apply(state: State, move: Move, now: number): State {
  if (state.phase === 'over' || move.rev !== state.rev) return state; // over, or made for an older step
  if (move.uid !== state.current || !state.alive.includes(move.uid)) return state;

  if (move.kind === 'open') {
    if (state.phase !== 'temple') return state;
    const s = edit(state);
    s.phase = 'pick';
    s.endsAt = now + PICK_MS;
    s.rev += 1;
    return s;
  }

  if (move.kind === 'pick') {
    if (state.phase !== 'pick') return state;
    const n = move.slip;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n >= DECK_SIZE || state.taken.includes(n)) return state;
    const s = edit(state);
    s.taken.push(n);
    s.slip = n;
    if (TIERS[deckFor(s.seed)[n].tier].auto) {
      answerSlip(s, null, now); // a bonus slip: no question
    } else {
      s.phase = 'answer';
      s.endsAt = now + ANSWER_MS;
      s.rev += 1;
    }
    return s;
  }

  // answer
  if (state.phase !== 'answer' || !isValidGuess(move.guess)) return state;
  const s = edit(state);
  answerSlip(s, move.guess, now);
  return s;
}

// ----------------------------------------------------------- timers ----
// A player who forfeited the game is out at once (no splash).
function dropPlayer(state: State, uid: string, now: number): State {
  const s = edit(state);
  const wasCurrent = s.current === uid;
  s.lives[uid] = 0;
  s.alive = s.alive.filter((id) => id !== uid);
  s.bag = s.bag.filter((id) => id !== uid);
  s.lastLeft = uid;
  if (s.alive.length <= 1) {
    endGame(s);
    return s;
  }
  // Their turn is cancelled. (During the reveal the turn is already over, so nothing else to do.)
  if (wasCurrent && s.phase !== 'reveal') startTurn(s, now);
  return s;
}

// Call a few times per second on the host. `left` = players who forfeited the game.
export function tick(state: State, now: number, left: string[] = []): State {
  if (state.phase === 'over') return state;
  for (const id of left) if (state.alive.includes(id)) return dropPlayer(state, id, now);
  if (state.endsAt === 0 || now < state.endsAt) return state;

  const s = edit(state);
  switch (state.phase) {
    case 'choosing':
      s.phase = 'temple';
      s.endsAt = now + TEMPLE_MS;
      s.rev += 1;
      break;
    case 'temple': // nobody tapped: the pane opens by itself
      s.phase = 'pick';
      s.endsAt = now + PICK_MS;
      s.rev += 1;
      break;
    case 'pick':
      noDraw(s, now);
      break;
    case 'answer':
      answerSlip(s, null, now);
      break;
    case 'reveal':
      nextTurn(s, now);
      break;
  }
  return s;
}

export const remainingNow = (state: State, receivedAt: number, now: number) =>
  Math.max(0, state.remainingMs - (now - receivedAt));
