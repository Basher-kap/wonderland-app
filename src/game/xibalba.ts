// Traps of Xibalba: pure rules, no React, no Firebase.
//
// The floor is COLS tiles wide and ROWS lines long. Everybody starts on the platform at the bottom
// and steps ONE line at a time, all at once: each player picks one tile of the next line in
// PICK_MS, nobody sees the others' picks, and when the time is up every step is revealed together.
// A tile is either TRUE (steppable) or FALSE (the player falls and is out). The further the line,
// the more FALSE tiles it has (FALSE_PER_ROW). A player who picks nothing in time falls.
//
// Players who cross the last line must walk BACK over the same tiles (same TRUE / FALSE layout).
// Only the tiles somebody stepped on are revealed, and only for a moment, so getting back means
// remembering. Players who make it back to the bottom face a NEW layout (the next "trap set") and
// the cycle goes on until one player is left. The last player left wins.
//
// If everybody still alive falls on the same step there is nobody left to win: the game ends as a
// draw (nobody finishes). Change `resolve` if you would rather replay that step.
//
// Like Fortune, the HOST's phone is the only one that runs the game: players send "moves" (pick a
// tile) and the host applies them with `apply`, calls `tick` a few times per second for the timers
// and saves the state, which every phone shows. The picks themselves stay on the host (`picks` is
// stripped by `publicState` before saving) until the step is revealed. A move carries the `rev`
// of the step it was made for, and `rev` only goes up, so an old move is ignored.
//
// NOT shown to the players on purpose (hidden notes): how many tiles are false on each line, that
// the picks are hidden until time is up, and that the layout is the same on the way back.
import { makeRng } from './schulte';

// ----------------------------------------------------------- tuning ----
export const COLS = 6;
export const ROWS = 6;
// FALSE tiles per line, from the first line (next to the start) to the last. Line 6 has only 2
// TRUE tiles, so 4 are false. Must have ROWS entries, each below COLS.
export const FALSE_PER_ROW: readonly number[] = [1, 2, 2, 3, 3, 4];
export const PICK_MS = 10000; // time to pick a tile; picking nothing = falling
export const REVEAL_MS = 4000; // the steps stay on screen (then every tile is covered again)

// ------------------------------------------------------------- map ----
// safe[row][col]: row 0 is the line next to the start platform, row ROWS-1 the last line.
export type TrapMap = boolean[][];

function shuffled<T>(items: readonly T[], rnd: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The layout of one trap set. Same seed + same set number = same layout on every phone.
export function buildMap(seed: string, setNo: number): TrapMap {
  const cols = Array.from({ length: COLS }, (_, c) => c);
  return FALSE_PER_ROW.map((falses, row) => {
    const order = shuffled(cols, makeRng(`${seed}:xibalba:${setNo}:${row}`));
    const safe: boolean[] = Array.from({ length: COLS }, () => true);
    for (const c of order.slice(0, falses)) safe[c] = false;
    return safe;
  });
}

const mapCache = new Map<string, TrapMap>();
export function mapFor(seed: string, setNo: number): TrapMap {
  const key = `${seed}#${setNo}`;
  let m = mapCache.get(key);
  if (!m) {
    if (mapCache.size > 40) mapCache.clear();
    m = buildMap(seed, setNo);
    mapCache.set(key, m);
  }
  return m;
}

export const isValidCol = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < COLS;

// ------------------------------------------------------------ state ----
export type Leg = 'forward' | 'back';
export type Phase = 'pick' | 'reveal' | 'over';

// What one player did in a step. col = null: they picked nothing in time.
export type StepResult = { uid: string; col: number | null; safe: boolean };

export type Reveal = {
  setNo: number;
  leg: Leg;
  row: number;
  steps: StepResult[];
  fell: string[];
  // Set on the last step of a leg, when somebody is still alive: they reached the other side
  // ('crossed') or the start again ('home').
  event: 'crossed' | 'home' | null;
};

export type State = {
  ver: number; // goes up on every change (the host saves when it changes)
  rev: number; // goes up on every step of the game (moves are made for one rev)
  seed: string;
  order: string[]; // everybody, fixed order for the screen
  alive: string[];
  setNo: number; // 0 = the first layout; a new one every time the players make it back
  leg: Leg;
  row: number; // the line being stepped on now (0 = next to the start)
  phase: Phase;
  locked: string[]; // players who have picked a tile this step (not WHICH tile)
  reveal: Reveal | null;
  lastLeft: string | null; // the last player who left (forfeited)
  winner: string | null;
  endsAt: number; // when the running timer ends, in the HOST's clock (0 = none)
  remainingMs: number; // filled in when the state is saved, so every phone can count down
  // HOST ONLY (empty in a saved state, see publicState): this step's picks, and the time of the
  // last move applied for each player, so an old move is never applied twice.
  picks: Record<string, number>;
  pickAt: Record<string, number>;
};

export type Move = { uid: string; rev: number; col: number; at: number };

// The state as it is saved for every phone: without anybody's pick.
export const publicState = (s: State): State => ({ ...s, picks: {}, pickAt: {} });

export function shuffleOrder(playerIds: string[], seed: string): string[] {
  return shuffled(playerIds, makeRng(`${seed}:xibalba:order`));
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
    setNo: 0,
    leg: 'forward',
    row: 0,
    phase: 'pick',
    locked: [],
    reveal: null,
    lastLeft: null,
    winner: null,
    endsAt: 0,
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
  s.winner = s.alive.length === 1 ? s.alive[0] : null; // nobody alive = a draw
  s.endsAt = 0;
  s.locked = [];
  s.rev += 1;
}

// ------------------------------------------------------------ moves ----
// A player picks (or changes the pick of) a tile of the line being stepped on. The last pick made
// before the time is up counts.
export function apply(state: State, move: Move): State {
  if (state.phase !== 'pick' || move.rev !== state.rev) return state; // not picking, or an older step
  if (!state.alive.includes(move.uid) || !isValidCol(move.col)) return state;
  if (move.at <= (state.pickAt[move.uid] ?? 0)) return state; // an older move than the one applied
  if (state.picks[move.uid] === move.col) return state; // same tile again: nothing changes
  const s = edit(state);
  s.picks[move.uid] = move.col;
  s.pickAt[move.uid] = move.at;
  if (!s.locked.includes(move.uid)) s.locked.push(move.uid);
  return s;
}

// ----------------------------------------------------------- timers ----
// The time is up: everybody's step is revealed and whoever picked a FALSE tile (or nothing) falls.
function resolve(s: State, now: number) {
  const safe = mapFor(s.seed, s.setNo)[s.row];
  const steps: StepResult[] = s.alive.map((uid) => {
    const col = s.picks[uid] ?? null;
    return { uid, col, safe: col !== null && safe[col] };
  });
  const fell = steps.filter((x) => !x.safe).map((x) => x.uid);
  s.alive = s.alive.filter((id) => !fell.includes(id));
  const lastOfLeg = s.leg === 'forward' ? s.row === ROWS - 1 : s.row === 0;
  const event = lastOfLeg && s.alive.length > 0 ? (s.leg === 'forward' ? 'crossed' : 'home') : null;
  s.reveal = { setNo: s.setNo, leg: s.leg, row: s.row, steps, fell, event };
  s.picks = {};
  s.pickAt = {};
  s.locked = [];
  s.phase = 'reveal';
  s.endsAt = now + REVEAL_MS;
  s.rev += 1;
}

// The reveal is over: the game ends if one player (or nobody) is left, else the next step.
function afterReveal(s: State, now: number) {
  if (s.alive.length <= 1) {
    endGame(s);
    return;
  }
  if (s.leg === 'forward') {
    if (s.row === ROWS - 1) {
      s.leg = 'back'; // crossed: now back over the same tiles, starting with the last line
    } else {
      s.row += 1;
    }
  } else if (s.row === 0) {
    s.leg = 'forward'; // back at the start: a new layout
    s.setNo += 1;
  } else {
    s.row -= 1;
  }
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
  // During the reveal the step is already settled: afterReveal decides what happens next.
  if (s.alive.length <= 1 && s.phase !== 'reveal') endGame(s);
  return s;
}

// Call a few times per second on the host. `left` = players who forfeited the game.
export function tick(state: State, now: number, left: string[] = []): State {
  if (state.phase === 'over') return state;
  for (const id of left) if (state.alive.includes(id)) return dropPlayer(state, id);
  if (state.endsAt === 0 || now < state.endsAt) return state;

  const s = edit(state);
  if (state.phase === 'pick') resolve(s, now);
  else afterReveal(s, now);
  return s;
}

export const remainingNow = (state: State, receivedAt: number, now: number) =>
  Math.max(0, state.remainingMs - (now - receivedAt));
