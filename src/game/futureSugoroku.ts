import { makeRng } from './schulte';
import { BAD_NOTES, GOOD_NOTES } from './futureSugorokuNotes';

// ----------------------------------------------------------- tuning ----
export const SIZE = 5;
export const CELLS = SIZE * SIZE;
export const START = 12; // C3, the middle room
export const START_POINTS = 15;
export const MAX_TURNS = 15;
export const PICK_MS = 45000; // time to choose a room; choosing nothing = staying
export const MIN_PICK_MS = 3000; // even if everybody has locked in, the turn lasts at least this long
export const REVEAL_MS = 6000; // the result of the turn stays on screen
export const MOVE_COST = 1; // what every player loses every turn
export const ALIGN_CAP = 99; // most extra points one player can lose to alignment (99 = no limit)
export const BONUS_POINTS = 3;
export const DANGER_POINTS = 5;
export const RECOVERY_POINTS = 6;

export type RoomKind = 'plain' | 'start' | 'exit' | 'bonus' | 'danger' | 'recovery';

// Rooms placed by hand, always the same.
const FIXED: Record<number, RoomKind> = { 6: 'bonus', 8: 'danger', 16: 'recovery', 18: 'danger' };
// Rooms placed at random places (the places depend on the seed).
const RANDOM_KINDS: RoomKind[] = ['danger', 'danger', 'danger', 'bonus', 'recovery'];

// ------------------------------------------------------------- map ----
export type SugorokuMap = {
  exit: number; // the room with the exit (on the outer ring)
  kinds: RoomKind[]; // the TRUE kind of every room
};

export const isOuter = (cell: number) => {
  const r = Math.floor(cell / SIZE);
  const c = cell % SIZE;
  return r === 0 || r === SIZE - 1 || c === 0 || c === SIZE - 1;
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

export const isValidCell = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < CELLS;

// "C3": the row letter and the column number.
export const cellName = (cell: number) => `${String.fromCharCode(65 + Math.floor(cell / SIZE))}${(cell % SIZE) + 1}`;

// Same row, same column or same diagonal (the same room is aligned too).
export function aligned(a: number, b: number): boolean {
  const dr = Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE));
  const dc = Math.abs((a % SIZE) - (b % SIZE));
  return dr === 0 || dc === 0 || dr === dc;
}

function shortestSafePath(kinds: RoomKind[], exit: number): number[] | null {
  const prev = new Map<number, number>([[START, -1]]);
  const queue = [START];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === exit) {
      const path: number[] = [];
      for (let n = exit; n !== -1; n = prev.get(n)!) path.unshift(n);
      return path;
    }
    for (const n of neighbors(cur)) {
      if (prev.has(n) || kinds[n] === 'danger') continue;
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
    const outer = Array.from({ length: CELLS }, (_, i) => i).filter(isOuter);
    const exit = outer[Math.floor(rnd() * outer.length)];
    kinds[exit] = 'exit';
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
    const path = shortestSafePath(kinds, exit);
    if (!path || path.length - 1 > 10) continue;
    return { exit, kinds };
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

// ------------------------------------------------------------ notes ----
export type Omen = 'good' | 'bad';

// What the rooms AFTER `to` look like for a player coming from `from`: bad when one of the rooms
// they could choose next (the neighbours of `to`, except `from`) is a danger room.
export function omenOf(map: SugorokuMap, from: number, to: number): Omen {
  return neighbors(to).some((n) => n !== from && map.kinds[n] === 'danger') ? 'bad' : 'good';
}

// The note on room `cell` for that omen. The same room and omen always give the same note.
export function noteFor(seed: string, omen: Omen, cell: number): string {
  const pool = omen === 'good' ? GOOD_NOTES : BAD_NOTES;
  return pool[Math.floor(makeRng(`${seed}:sugoroku:note:${omen}:${cell}`)() * pool.length)];
}

// ------------------------------------------------------------ state ----
export type Phase = 'pick' | 'reveal' | 'over';
export type Effect = 'bonus' | 'danger' | 'recovery';

export type StepResult = {
  uid: string;
  from: number;
  to: number; // where the player is after the turn
  moved: boolean; // false: stayed (chose nothing in time)
  cost: number; // what the turn cost: MOVE_COST + the alignment extra
  aligned: number; // how many other players' chosen rooms were aligned with theirs
  effect: Effect | null; // what the room did (only for the player who stepped in)
  delta: number; // the points the room gave (+) or took (-)
  escaped: boolean;
};

export type Reveal = {
  turn: number;
  steps: StepResult[];
  out: string[]; // ran out of Survival Points this turn
  escaped: string[]; // found the exit this turn
};

export type State = {
  ver: number; // goes up on every change (the host saves when it changes)
  rev: number; // goes up on every turn and phase (moves are made for one rev)
  seed: string;
  order: string[]; // everybody, fixed order for the screen
  alive: string[]; // still in the labyrinth (after the end: only those who escaped)
  turn: number; // 1..MAX_TURNS
  phase: Phase;
  pos: Record<string, number>;
  prev: Record<string, number>; // the room each player just came from (-1 = none yet)
  sp: Record<string, number>; // Survival Points
  stood: Record<string, number[]>; // the rooms each player has stood in (the ones they have found out)
  used: Record<string, number[]>; // the rooms whose effect a player already got
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

// The rooms a player may choose now: the neighbours of their room except the one they came from.
export const optionsOf = (s: State, uid: string): number[] =>
  neighbors(s.pos[uid]).filter((n) => n !== s.prev[uid]);

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
    turn: 1,
    phase: 'pick',
    pos: Object.fromEntries(order.map((id) => [id, START])),
    prev: Object.fromEntries(order.map((id) => [id, -1])),
    sp: Object.fromEntries(order.map((id) => [id, START_POINTS])),
    stood: Object.fromEntries(order.map((id) => [id, [START]])),
    used: Object.fromEntries(order.map((id) => [id, [] as number[]])),
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
// A player picks (or changes the pick of) the room to walk into: one of the rooms next to theirs,
// but not the one they came from. The last pick made before the turn is resolved counts.
export function apply(state: State, move: Move): State {
  if (state.phase !== 'pick' || move.rev !== state.rev) return state;
  if (!state.alive.includes(move.uid) || !isValidCell(move.to)) return state;
  if (move.at <= (state.pickAt[move.uid] ?? 0)) return state;
  if (!optionsOf(state, move.uid).includes(move.to)) return state;
  if (state.picks[move.uid] === move.to) return state;
  const s = edit(state);
  s.picks[move.uid] = move.to;
  s.pickAt[move.uid] = move.at;
  if (!s.locked.includes(move.uid)) s.locked.push(move.uid);
  return s;
}

// ----------------------------------------------------------- timers ----
// Everybody's move is made at once; alignment is counted on the rooms they CHOSE.
function resolve(s: State, now: number) {
  const map = mapFor(s.seed);
  const movers = s.alive.filter((id) => s.picks[id] !== undefined);
  const steps: StepResult[] = [];
  const escaped: string[] = [];

  for (const uid of s.alive) {
    const from = s.pos[uid];
    const moved = s.picks[uid] !== undefined;
    const to = moved ? s.picks[uid] : from;
    const alignedWith = moved ? movers.filter((o) => o !== uid && aligned(s.picks[o], to)).length : 0;
    const step: StepResult = {
      uid,
      from,
      to,
      moved,
      cost: MOVE_COST + Math.min(alignedWith, ALIGN_CAP),
      aligned: alignedWith,
      effect: null,
      delta: 0,
      escaped: false,
    };
    if (moved) {
      s.prev[uid] = from;
      s.pos[uid] = to;
      if (!s.stood[uid].includes(to)) s.stood[uid].push(to);
      const kind = map.kinds[to];
      if (kind === 'exit') {
        step.escaped = true;
        escaped.push(uid);
      } else if ((kind === 'bonus' || kind === 'danger' || kind === 'recovery') && !s.used[uid].includes(to)) {
        const delta =
          kind === 'bonus'
            ? BONUS_POINTS
            : kind === 'danger'
              ? -DANGER_POINTS
              : Math.min(RECOVERY_POINTS, Math.max(0, START_POINTS - s.sp[uid]));
        if (delta !== 0) {
          step.effect = kind;
          step.delta = delta;
          s.used[uid].push(to);
        }
      }
    }
    steps.push(step);
  }

  // Points are taken after everybody has moved. Whoever escaped pays nothing.
  const out: string[] = [];
  for (const step of steps) {
    if (step.escaped) continue;
    s.sp[step.uid] = s.sp[step.uid] - step.cost + step.delta;
    if (s.sp[step.uid] <= 0) {
      s.sp[step.uid] = 0;
      out.push(step.uid);
    }
  }
  s.alive = s.alive.filter((id) => !out.includes(id));
  s.winners = escaped;
  s.reveal = { turn: s.turn, steps, out, escaped };
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