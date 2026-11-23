// Beauty Contest: pure rules, no React, no Firebase.
//
// Everybody picks a whole number from 0 to 100 (secretly, in PICK_MS). When the time is up (or
// everybody has locked in) all the numbers are revealed: the average of the numbers is multiplied
// by 0.8 to make the TARGET, and whoever is closest to the target wins the round. Everybody else
// loses 1 point. Points start at 0; a player who reaches LOSE_AT (-10) is out (GAME OVER). The last
// player left wins the game.
//
// SPECIAL RULES come one by one as players are eliminated, and they pile up:
//   4 players left  'unique'   a number chosen by two or more players is INVALID: those players
//                              lose a point even if their number was the closest.
//   3 players left  'exact'    a player who picks EXACTLY the target makes everybody else lose 2.
//   2 players left  'extremes' if one player picks 0, the other wins the round by picking 100.
// A rule starts in the round AFTER the players were eliminated (it is announced in the reveal).
//
// ROUND DETAILS (decisions, change them here):
//  - The average counts every number that was handed in, invalid ones too. A player who handed in
//    nothing is not in the average, cannot win, and loses a point.
//  - Closeness is compared with whole numbers (|5n x number - 4 x sum|), so decimals and ties are
//    exact. Players who are EQUALLY close all win the round (nobody among them loses a point).
//  - If nobody can win (nobody picked, or every number was invalid) everybody loses a point.
//  - After ROUND_CAP rounds the game ends: most points wins, a tie for the most is a draw.
//
// Like Fortune and Xibalba, the HOST's phone is the only one that runs the game: players send
// "moves" (lock in a number) and the host applies them with `apply`, calls `tick` a few times per
// second for the timers and saves the state, which every phone shows. The numbers stay on the host
// (`picks` is stripped by `publicState`) until the reveal. A move carries the `rev` of the round it
// was made for, and `rev` only goes up, so an old move is ignored.
import { makeRng } from './schulte';

// ----------------------------------------------------------- tuning ----
export const MIN_NUMBER = 0;
export const MAX_NUMBER = 100;
export const FACTOR_NUM = 4; // the target is the average x 0.8 = x 4/5, kept as a fraction
export const FACTOR_DEN = 5;
export const LOSE_AT = -10;
export const PICK_MS = 30000;
export const MIN_PICK_MS = 3000; // even if everybody has locked in, the round lasts at least this long
export const REVEAL_MS = 10000;
export const ROUND_CAP = 40;

export type RuleId = 'unique' | 'exact' | 'extremes';

// The rules in force when this many players are left.
export function rulesFor(left: number): RuleId[] {
  const rules: RuleId[] = [];
  if (left <= 4) rules.push('unique');
  if (left <= 3) rules.push('exact');
  if (left <= 2) rules.push('extremes');
  return rules;
}

export const RULE_TEXT: Record<RuleId, string> = {
  unique: 'If two or more players choose the same number, that number is invalid. They lose a point even if it is the closest.',
  exact: 'Choosing the exact target number makes every other player lose two points instead of one.',
  extremes: 'If one player chooses 0, the other player can win by choosing 100.',
};

export const isValidNumber = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= MIN_NUMBER && n <= MAX_NUMBER;

// ------------------------------------------------------------ state ----
export type Phase = 'pick' | 'reveal' | 'over';
export type RowStatus = 'won' | 'lost' | 'invalid' | 'none';
export type WinReason = 'closest' | 'tie' | 'exact' | 'extremes' | 'nobody';

export type Row = {
  uid: string;
  value: number | null; // null: handed in nothing
  away: number | null; // how far from the target (null: not compared)
  status: RowStatus;
};

export type Reveal = {
  round: number;
  rows: Row[];
  count: number; // numbers handed in
  average: number | null;
  target: number | null;
  winners: string[];
  reason: WinReason;
  penalty: number; // points the others lose: 1, or 2 with an exact hit
  out: string[]; // reached -10 in this round
  newRules: RuleId[]; // start in the next round
};

export type State = {
  ver: number; // goes up on every change (the host saves when it changes)
  rev: number; // goes up on every round and phase (moves are made for one rev)
  seed: string;
  order: string[]; // everybody, fixed order for the circle
  alive: string[];
  pts: Record<string, number>; // 0, -1, -2 ... down to -10
  round: number;
  phase: Phase;
  locked: string[]; // players who have locked in a number (not WHICH number)
  reveal: Reveal | null;
  lastLeft: string | null; // the last player who left (forfeited)
  winner: string | null;
  endsAt: number; // when the running timer ends, in the HOST's clock (0 = none)
  pickFrom: number; // when this round's picking started, in the HOST's clock
  remainingMs: number; // filled in when the state is saved, so every phone can count down
  // HOST ONLY (empty in a saved state, see publicState).
  picks: Record<string, number>;
  pickAt: Record<string, number>;
};

export type Move = { uid: string; rev: number; value: number; at: number };

export const publicState = (s: State): State => ({ ...s, picks: {}, pickAt: {} });

export function shuffleOrder(playerIds: string[], seed: string): string[] {
  const a = playerIds.slice();
  const rnd = makeRng(`${seed}:beauty:order`);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function edit(s: State): State {
  const c: State = JSON.parse(JSON.stringify(s));
  c.ver = s.ver + 1;
  return c;
}

function startPick(s: State, now: number) {
  s.phase = 'pick';
  s.picks = {};
  s.pickAt = {};
  s.locked = [];
  s.reveal = null;
  s.pickFrom = now;
  s.endsAt = now + PICK_MS;
  s.rev += 1;
}

export function newGame(order: string[], seed: string, now: number): State {
  const s: State = {
    ver: 1,
    rev: 0,
    seed,
    order: order.slice(),
    alive: order.slice(),
    pts: Object.fromEntries(order.map((id) => [id, 0])),
    round: 1,
    phase: 'pick',
    locked: [],
    reveal: null,
    lastLeft: null,
    winner: null,
    endsAt: 0,
    pickFrom: now,
    remainingMs: 0,
    picks: {},
    pickAt: {},
  };
  startPick(s, now);
  s.remainingMs = PICK_MS;
  return s;
}

function endGame(s: State) {
  s.phase = 'over';
  if (s.alive.length === 1) s.winner = s.alive[0];
  else if (s.alive.length === 0) s.winner = null;
  else {
    // the round cap: the most points wins, a tie for the most is a draw
    const best = Math.max(...s.alive.map((id) => s.pts[id]));
    const top = s.alive.filter((id) => s.pts[id] === best);
    s.winner = top.length === 1 ? top[0] : null;
  }
  s.endsAt = 0;
  s.locked = [];
  s.rev += 1;
}

// ------------------------------------------------------------ moves ----
// A player locks in (or changes) their number. The last number locked in before the round is
// resolved counts.
export function apply(state: State, move: Move): State {
  if (state.phase !== 'pick' || move.rev !== state.rev) return state;
  if (!state.alive.includes(move.uid) || !isValidNumber(move.value)) return state;
  if (move.at <= (state.pickAt[move.uid] ?? 0)) return state;
  if (state.picks[move.uid] === move.value) return state;
  const s = edit(state);
  s.picks[move.uid] = move.value;
  s.pickAt[move.uid] = move.at;
  if (!s.locked.includes(move.uid)) s.locked.push(move.uid);
  return s;
}

// ----------------------------------------------------------- timers ----
// The time is up: reveal everything, work out the winner, take the points, eliminate.
function resolve(s: State, now: number) {
  const rules = rulesFor(s.alive.length);
  const pickers = s.alive.filter((id) => s.picks[id] !== undefined);
  const n = pickers.length;
  const sum = pickers.reduce((t, id) => t + s.picks[id], 0);
  const rows: Row[] = s.alive.map((id) => ({
    uid: id,
    value: s.picks[id] ?? null,
    away: null,
    status: s.picks[id] === undefined ? 'none' : 'lost',
  }));
  const row = (id: string) => rows.find((r) => r.uid === id)!;

  let winners: string[] = [];
  let reason: WinReason = 'nobody';
  let average: number | null = null;
  let target: number | null = null;

  if (n > 0) {
    average = sum / n;
    target = (FACTOR_NUM * sum) / (FACTOR_DEN * n);
    // distance x (n x FACTOR_DEN): whole numbers, so ties and exact hits are exact
    const scaled = (v: number) => Math.abs(FACTOR_DEN * n * v - FACTOR_NUM * sum);
    for (const id of pickers) row(id).away = scaled(s.picks[id]) / (FACTOR_DEN * n);

    const zero = pickers.filter((id) => s.picks[id] === MIN_NUMBER);
    const hundred = pickers.filter((id) => s.picks[id] === MAX_NUMBER);
    if (rules.includes('extremes') && s.alive.length === 2 && n === 2 && zero.length === 1 && hundred.length === 1) {
      winners = hundred;
      reason = 'extremes';
    } else {
      let candidates = pickers;
      if (rules.includes('unique')) {
        const count = new Map<number, number>();
        for (const id of pickers) count.set(s.picks[id], (count.get(s.picks[id]) ?? 0) + 1);
        for (const id of pickers) if ((count.get(s.picks[id]) ?? 0) > 1) row(id).status = 'invalid';
        candidates = pickers.filter((id) => row(id).status !== 'invalid');
      }
      if (candidates.length > 0) {
        const best = Math.min(...candidates.map((id) => scaled(s.picks[id])));
        winners = candidates.filter((id) => scaled(s.picks[id]) === best);
        reason = best === 0 ? 'exact' : winners.length > 1 ? 'tie' : 'closest';
      }
    }
  }

  for (const id of winners) row(id).status = 'won';
  const penalty = reason === 'exact' && rules.includes('exact') ? 2 : 1;
  for (const r of rows) if (r.status !== 'won') s.pts[r.uid] = Math.max(LOSE_AT, s.pts[r.uid] - penalty);
  const out = s.alive.filter((id) => s.pts[id] <= LOSE_AT);
  s.alive = s.alive.filter((id) => !out.includes(id));
  const newRules = s.alive.length > 1 ? rulesFor(s.alive.length).filter((r) => !rules.includes(r)) : [];

  s.reveal = { round: s.round, rows, count: n, average, target, winners, reason, penalty, out, newRules };
  s.picks = {};
  s.pickAt = {};
  s.locked = [];
  s.phase = 'reveal';
  s.endsAt = now + REVEAL_MS;
  s.rev += 1;
}

// The reveal is over: the game ends when one player (or nobody) is left, else the next round.
function afterReveal(s: State, now: number) {
  if (s.alive.length <= 1 || s.round >= ROUND_CAP) {
    endGame(s);
    return;
  }
  s.round += 1;
  startPick(s, now);
}

// A player who forfeited the game is out at once (no points are taken).
function dropPlayer(state: State, uid: string): State {
  const s = edit(state);
  s.alive = s.alive.filter((id) => id !== uid);
  s.locked = s.locked.filter((id) => id !== uid);
  delete s.picks[uid];
  delete s.pickAt[uid];
  s.lastLeft = uid;
  // During the reveal the round is already settled: afterReveal decides what happens next.
  if (s.alive.length <= 1 && s.phase !== 'reveal') endGame(s);
  return s;
}

// Call a few times per second on the host. `left` = players who forfeited the game.
export function tick(state: State, now: number, left: string[] = []): State {
  if (state.phase === 'over') return state;
  for (const id of left) if (state.alive.includes(id)) return dropPlayer(state, id);
  if (state.phase === 'pick') {
    const allIn = state.alive.every((id) => state.locked.includes(id)) && now >= state.pickFrom + MIN_PICK_MS;
    if (!allIn && now < state.endsAt) return state;
    const s = edit(state);
    resolve(s, now);
    return s;
  }
  if (state.endsAt === 0 || now < state.endsAt) return state;
  const s = edit(state);
  afterReveal(s, now);
  return s;
}

export const remainingNow = (state: State, receivedAt: number, now: number) =>
  Math.max(0, state.remainingMs - (now - receivedAt));

// A number as shown on screen: two decimals.
export const fmt = (x: number) => x.toFixed(2);