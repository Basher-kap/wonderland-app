// Future Sugoroku: pure rules, no React, no Firebase.
//
// A SIZE x SIZE labyrinth of chambers (5 x 5 = 25 rooms, numbered 0..24 row by row, so 0 is the
// top-left and 24 the bottom-right). Everybody starts in START (bottom-left) with START_POINTS
// Survival Points, and the portal (EXIT, top-right) is the way out. The game lasts MAX_TURNS turns.
//
// Every turn ONE six-sided die is rolled for everybody. Every doorway between two neighbouring
// rooms carries a number 1-6, and you may only walk through a doorway whose number is the die. Each
// player secretly picks the room to walk into (or to stay); when everybody has picked (or PICK_MS
// is over) all the steps are resolved at once. A player with no doorway for the die stays put.
// Every turn each player who has not escaped loses 1 Survival Point, moving or not; at 0 they are out.
//
// Special rooms (a few at fixed places, the rest at random places of the seed):
//   bonus    +BONUS_POINTS the first time you walk in
//   danger   -DANGER_POINTS the first time you walk in
//   recovery +RECOVERY_POINTS (never above START_POINTS) the first time you walk in
//   locked   the door resists: whoever tries it first stays where they were, and from the next turn
//            on it is open for everybody
//   illusion looks like a bonus room until somebody walks in: then it is exposed for everybody, it
//            gives nothing and the player is thrown back to the room they came from
//
// Whoever walks into the portal escapes. The game ends at the end of the turn in which somebody
// escaped (everybody who escaped in that same turn shares the victory), when nobody is left, or
// when MAX_TURNS is over (everybody still inside is out).
//
// Like Fortune and Xibalba, the HOST's phone is the only one that runs the game: players send
// "moves" (the room they walk into) and the host applies them with `apply`, calls `tick` a few
// times per second for the timers and saves the state, which every phone shows. The picks stay on
// the host (`picks` is stripped by `publicState`) until the turn is resolved. A move carries the
// `rev` of the turn it was made for, and `rev` only goes up, so an old move is ignored.
//
// FAIRNESS (hidden note): the map is built so a safe route (no danger, locked or illusion room)
// exists that can be walked with the dice of the game and ends by turn 12 at the latest.
//
// NOT shown to the players on purpose (hidden notes): the special rooms and their numbers, that
// the dice are made from the seed, that each effect works only once per player, that a locked room
// opens for everybody after one try, and that the route is guaranteed.
import { makeRng } from './schulte';

// ----------------------------------------------------------- tuning ----
export const SIZE = 5;
export const CELLS = SIZE * SIZE;
export const START = 20;
export const EXIT = 4;
export const START_POINTS = 15;
export const MAX_TURNS = 15;
export const PICK_MS = 20000; // time to choose a doorway; choosing nothing = staying
export const MIN_PICK_MS = 2500; // even if everybody has picked, the die stays on screen this long
export const REVEAL_MS = 3500; // the result of the turn stays on screen
export const BONUS_POINTS = 3;
export const DANGER_POINTS = 4;
export const RECOVERY_POINTS = 6;

export type RoomKind = 'plain' | 'start' | 'exit' | 'bonus' | 'danger' | 'recovery' | 'locked' | 'illusion';

// Rooms placed by hand, always the same.
const FIXED: Record<number, RoomKind> = { 12: 'recovery', 3: 'danger', 6: 'bonus' };
// Rooms placed at random places (the places depend on the seed).
const RANDOM_KINDS: RoomKind[] = ['bonus', 'danger', 'danger', 'recovery', 'locked', 'locked', 'illusion', 'illusion'];
const HAZARDS: RoomKind[] = ['danger', 'locked', 'illusion'];

// ------------------------------------------------------------- map ----
export type SugorokuMap = {
  kinds: RoomKind[]; // the TRUE kind of every room
  door: Record<string, number>; // "a-b" (a < b) -> the doorway number 1..6
};

export const neighbors = (cell: number): number[] => {
  const r = Math.floor(cell / SIZE);
  const c = cell % SIZE;
  const out: number[] = [];
  if (r > 0) out.push(cell - SIZE);
  if (r < SIZE - 1) out.push(cell + SIZE);
  if (c > 0) out.push(cell - 1);
  if (c < SIZE - 1) out.push(cell + 1);
  return out;
};

export const doorKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// The shared die of a turn (1-based). Same seed + same turn = same die on every phone.
export function diceFor(seed: string, turn: number): number {
  return 1 + Math.floor(makeRng(`${seed}:sugoroku:dice:${turn}`)() * 6);
}

function shortestSafePath(kinds: RoomKind[]): number[] | null {
  const prev = new Map<number, number>([[START, -1]]);
  const queue = [START];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === EXIT) {
      const path: number[] = [];
      for (let n = EXIT; n !== -1; n = prev.get(n)!) path.unshift(n);
      return path;
    }
    for (const n of neighbors(cur)) {
      if (prev.has(n) || HAZARDS.includes(kinds[n])) continue;
      prev.set(n, cur);
      queue.push(n);
    }
  }
  return null;
}

export function buildMap(seed: string): SugorokuMap {
  for (let salt = 0; ; salt++) {
    const rnd = makeRng(`${seed}:sugoroku:map:${salt}`);
    const kinds: RoomKind[] = Array.from({ length: CELLS }, () => 'plain');
    kinds[START] = 'start';
    kinds[EXIT] = 'exit';
    for (const [cell, kind] of Object.entries(FIXED)) kinds[Number(cell)] = kind;
    if (salt < 100) {
      // after 100 failed tries (practically never) the random rooms are left out
      const free = Array.from({ length: CELLS }, (_, i) => i).filter((i) => kinds[i] === 'plain');
      for (let i = free.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [free[i], free[j]] = [free[j], free[i]];
      }
      RANDOM_KINDS.forEach((kind, i) => (kinds[free[i]] = kind));
    }
    const path = shortestSafePath(kinds);
    if (!path || path.length - 1 > 11) continue;

    // Every doorway gets a random number, then the safe route is made walkable with the dice.
    const door: Record<string, number> = {};
    for (let a = 0; a < CELLS; a++) for (const b of neighbors(a)) if (a < b) door[doorKey(a, b)] = 1 + Math.floor(rnd() * 6);
    let t = Math.floor(rnd() * 2); // 0-based index of the turn of the first step
    const steps = path.length - 1;
    const turns: number[] = [];
    for (let i = 0; i < steps; i++) {
      turns.push(t);
      t += 1 + (rnd() < 0.4 ? 1 : 0);
    }
    if (turns[steps - 1] > 11) for (let i = 0; i < steps; i++) turns[i] = i; // no waiting at all
    for (let i = 0; i < steps; i++) door[doorKey(path[i], path[i + 1])] = diceFor(seed, turns[i] + 1);
    return { kinds, door };
  }
}

const mapCache = new Map<string, SugorokuMap>();
export function mapFor(seed: string): SugorokuMap {
  let m = mapCache.get(seed);
  if (!m) {
    if (mapCache.size > 20) mapCache.clear();
    m = buildMap(seed);
    mapCache.set(seed, m);
  }
  return m;
}

// The rooms you may walk into from `cell` with this die.
export const exitsFor = (map: SugorokuMap, cell: number, dice: number): number[] =>
  neighbors(cell).filter((n) => map.door[doorKey(cell, n)] === dice);

export const isValidCell = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < CELLS;

// ------------------------------------------------------------ state ----
export type Phase = 'pick' | 'reveal' | 'over';
export type Outcome = 'stayed' | 'moved' | 'locked' | 'illusion' | 'exit';
export type Effect = 'bonus' | 'danger' | 'recovery';

export type StepResult = {
  uid: string;
  from: number;
  to: number; // where the player is after the step (a thrown-back player is back in `from`)
  outcome: Outcome;
  effect: Effect | null;
  delta: number; // the points the room gave (+) or took (-)
};

export type Reveal = {
  turn: number;
  dice: number;
  steps: StepResult[];
  out: string[]; // ran out of Survival Points this turn
  escaped: string[]; // walked into the portal this turn
};

export type State = {
  ver: number; // goes up on every change (the host saves when it changes)
  rev: number; // goes up on every turn and phase (moves are made for one rev)
  seed: string;
  order: string[]; // everybody, fixed order for the screen
  alive: string[]; // still in the labyrinth (after the end: only those who escaped)
  turn: number; // 1..MAX_TURNS
  dice: number; // the shared die of this turn
  phase: Phase;
  pos: Record<string, number>;
  sp: Record<string, number>; // Survival Points
  stood: Record<string, number[]>; // the rooms each player has stood in (what they have explored)
  used: Record<string, number[]>; // the rooms whose effect a player already got
  unlocked: number[]; // locked rooms that are open now
  exposed: number[]; // illusion rooms that were walked into (they show their true face)
  locked: string[]; // players who have picked this turn (not WHICH room)
  reveal: Reveal | null;
  lastLeft: string | null; // the last player who left (forfeited)
  winners: string[]; // who escaped (several = a shared victory)
  endsAt: number; // when the running timer ends, in the HOST's clock (0 = none)
  pickFrom: number; // when this turn's picking started, in the HOST's clock
  remainingMs: number; // filled in when the state is saved, so every phone can count down
  // HOST ONLY (empty in a saved state, see publicState).
  picks: Record<string, number>;
  pickAt: Record<string, number>;
};

export type Move = { uid: string; rev: number; to: number; at: number };

export const publicState = (s: State): State => ({ ...s, picks: {}, pickAt: {} });

// The room a player SEES: an illusion room looks like a bonus room until it is exposed.
export const shownKind = (map: SugorokuMap, s: State, cell: number): RoomKind =>
  map.kinds[cell] === 'illusion' && !s.exposed.includes(cell) ? 'bonus' : map.kinds[cell];

// What a player has explored: every room they stood in and the rooms next to them.
export function seenBy(s: State, uid: string): Set<number> {
  const seen = new Set<number>();
  for (const c of s.stood[uid] ?? []) {
    seen.add(c);
    for (const n of neighbors(c)) seen.add(n);
  }
  return seen;
}

export function shuffleOrder(playerIds: string[], seed: string): string[] {
  const a = playerIds.slice();
  const rnd = makeRng(`${seed}:sugoroku:order`);
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
  const map = mapFor(s.seed);
  s.phase = 'pick';
  s.dice = diceFor(s.seed, s.turn);
  s.picks = {};
  s.pickAt = {};
  s.locked = [];
  s.reveal = null;
  // Nobody has a doorway for this die: they stay, there is nothing to decide.
  for (const id of s.alive) {
    if (exitsFor(map, s.pos[id], s.dice).length === 0) {
      s.picks[id] = s.pos[id];
      s.locked.push(id);
    }
  }
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
    turn: 1,
    dice: 1,
    phase: 'pick',
    pos: Object.fromEntries(order.map((id) => [id, START])),
    sp: Object.fromEntries(order.map((id) => [id, START_POINTS])),
    stood: Object.fromEntries(order.map((id) => [id, [START]])),
    used: Object.fromEntries(order.map((id) => [id, [] as number[]])),
    unlocked: [],
    exposed: [],
    locked: [],
    reveal: null,
    lastLeft: null,
    winners: [],
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
  s.alive = s.alive.filter((id) => s.winners.includes(id)); // everybody else is out
  s.endsAt = 0;
  s.locked = [];
  s.rev += 1;
}

// ------------------------------------------------------------ moves ----
// A player picks (or changes the pick of) the room to walk into: a room behind a doorway that
// carries the die, or their own room to stay. The last pick made before the turn is resolved counts.
export function apply(state: State, move: Move): State {
  if (state.phase !== 'pick' || move.rev !== state.rev) return state;
  if (!state.alive.includes(move.uid) || !isValidCell(move.to)) return state;
  if (move.at <= (state.pickAt[move.uid] ?? 0)) return state;
  const here = state.pos[move.uid];
  if (move.to !== here && !exitsFor(mapFor(state.seed), here, state.dice).includes(move.to)) return state;
  if (state.picks[move.uid] === move.to) return state;
  const s = edit(state);
  s.picks[move.uid] = move.to;
  s.pickAt[move.uid] = move.at;
  if (!s.locked.includes(move.uid)) s.locked.push(move.uid);
  return s;
}

// ----------------------------------------------------------- timers ----
// Everybody's step is resolved at once, then every player who has not escaped pays 1 point.
function resolve(s: State, now: number) {
  const map = mapFor(s.seed);
  const steps: StepResult[] = [];
  const tried: number[] = [];
  const escaped: string[] = [];

  for (const uid of s.alive) {
    const from = s.pos[uid];
    const want = s.picks[uid] ?? from;
    const step: StepResult = { uid, from, to: from, outcome: 'stayed', effect: null, delta: 0 };
    if (want !== from) {
      const kind = map.kinds[want];
      if (kind === 'locked' && !s.unlocked.includes(want)) {
        step.outcome = 'locked';
        tried.push(want);
      } else if (kind === 'illusion') {
        step.outcome = 'illusion';
        if (!s.exposed.includes(want)) s.exposed.push(want);
      } else {
        step.outcome = 'moved';
        step.to = want;
        const used = s.used[uid];
        if (kind === 'exit') {
          step.outcome = 'exit';
          escaped.push(uid);
        } else if ((kind === 'bonus' || kind === 'danger' || kind === 'recovery') && !used.includes(want)) {
          const delta =
            kind === 'bonus'
              ? BONUS_POINTS
              : kind === 'danger'
                ? -DANGER_POINTS
                : Math.min(RECOVERY_POINTS, Math.max(0, START_POINTS - s.sp[uid]));
          if (delta !== 0) {
            step.effect = kind;
            step.delta = delta;
            s.sp[uid] += delta;
            used.push(want);
          }
        }
      }
    }
    s.pos[uid] = step.to;
    if (!s.stood[uid].includes(step.to)) s.stood[uid].push(step.to);
    steps.push(step);
  }
  for (const room of tried) if (!s.unlocked.includes(room)) s.unlocked.push(room); // the door gave way

  const out: string[] = [];
  for (const uid of s.alive) {
    if (escaped.includes(uid)) continue;
    s.sp[uid] -= 1;
    if (s.sp[uid] <= 0) {
      s.sp[uid] = 0;
      out.push(uid);
    }
  }
  s.alive = s.alive.filter((id) => !out.includes(id));
  s.winners = escaped;
  s.reveal = { turn: s.turn, dice: s.dice, steps, out, escaped };
  s.picks = {};
  s.pickAt = {};
  s.locked = [];
  s.phase = 'reveal';
  s.endsAt = now + REVEAL_MS;
  s.rev += 1;
}

function afterReveal(s: State, now: number) {
  if (s.winners.length > 0 || s.alive.length === 0 || s.turn >= MAX_TURNS) {
    endGame(s);
    return;
  }
  s.turn += 1;
  startPick(s, now);
}

// A player who forfeited the game is out at once.
function dropPlayer(state: State, uid: string): State {
  const s = edit(state);
  s.alive = s.alive.filter((id) => id !== uid);
  s.locked = s.locked.filter((id) => id !== uid);
  delete s.picks[uid];
  delete s.pickAt[uid];
  s.lastLeft = uid;
  if (s.alive.length === 0 && s.phase !== 'reveal') endGame(s);
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

// ----------------------------------------------------------- results ----
export type Result = { uid: string; finished: boolean; totalMs: number; forfeited?: boolean };

// Only players who escaped report finished: true. One of them = the winner. Several (a shared
// victory) or none = a draw, because a round can only have ONE winner in the match model.
export function pickWinner(results: Result[]): string | null {
  const done = results.filter((r) => r.finished && !r.forfeited);
  return done.length === 1 ? done[0].uid : null;
}