// Battleships: pure rules, no React, no Firebase.
//
// Every player secretly places SHIP_COUNT battleships on a 5x5 grid (15 seconds). Then the players
// take turns, in a random order, to shoot one cell of the shared (empty) grid. Everybody sees the
// mark. Each player has BULLETS bullets:
//   - a shot that hits an enemy battleship keeps the bullet (and sinks the ship);
//   - a shot that hits nothing loses a bullet (a miss);
//   - a shot that hits only YOUR OWN battleship also loses a bullet (and sinks your ship);
//   - if an enemy battleship happens to be on the same cell as your own, the shot counts as a hit:
//     the two cancel out and no bullet is lost (both ships are sunk).
// A player with no battleship left is out. The players remaining with their battleships clear the
// game: the last player with a battleship wins; if nobody can shoot any more (no bullets left, or no
// free cell), the player with the most battleships wins, then the one with the most bullets; a tie
// for the top is a draw.
//
// The game is a small state machine, like Magical Banana and Fortune. The HOST's phone is the only
// one that runs it: players send "moves" (place / shoot) and the host applies them with `apply`,
// and calls `tick` a few times per second for the timers. A shot carries the `rev` of the state it
// was made for, and `rev` only goes up, so an old or repeated move is ignored.
//
// SECRET: where the ships are is NOT part of the state that is saved for everybody (`publicState`
// strips it). The host keeps it in memory, and can rebuild it from the placement moves
// (`withShips`) if its phone restarts.
import { makeRng } from './schulte';

// ----------------------------------------------------------- tuning ----
export const GRID = 5;
export const CELL_COUNT = GRID * GRID;
export const SHIP_COUNT = 7;
export const BULLETS = 5;
export const PLACE_MS = 15000; // time to place the ships
export const PLACE_GRACE_MS = 2000; // the host waits this long after the timer for late placements
export const COUNTDOWN_MS = 3000; // "battle start" before the first turn
export const TURN_MS = 10000; // time to shoot; too slow = lose a bullet (not stated in the rules: tune here)
export const RESULT_MS = 2500; // the result of a shot stays on screen before the next turn

export type Phase = 'placing' | 'countdown' | 'aiming' | 'result' | 'over';

// What happened to one shot.
//   miss    = nothing on the cell: -1 bullet
//   hit     = an enemy battleship was sunk: no bullet lost
//   neutral = an enemy battleship AND the shooter's own were on the cell: both sunk, no bullet lost
//   own     = only the shooter's own battleship was on the cell: it is sunk, -1 bullet
//   timeout = no shot in time: -1 bullet, no cell
export type Outcome = 'miss' | 'hit' | 'neutral' | 'own' | 'timeout';

export type Shot = {
  n: number; // shot number, 1-based
  by: string;
  cell: number | null; // null = timeout
  outcome: Outcome;
  victims: string[]; // players whose battleship was sunk (not the shooter)
  lostBullet: boolean;
  out: string[]; // players who have no battleship left after this shot (new this shot)
};

export type State = {
  ver: number; // goes up on every change (the host saves when it changes)
  rev: number; // goes up on every step of the game (shots are made for one rev)
  seed: string;
  order: string[]; // everybody, fixed order for the screen
  turnOrder: string[]; // the random order of the turns
  cursor: number; // index in turnOrder of the player whose turn it is (or was)
  phase: Phase;
  placed: string[]; // players whose own placement was accepted (the rest are filled in by the host)
  out: string[]; // players who forfeited the game
  shipsLeft: Record<string, number>; // public: how many battleships each player still has
  bullets: Record<string, number>;
  destroyed: Record<string, number[]>; // public: cells where a player's battleship was sunk
  shots: Shot[];
  current: string | null;
  turn: number;
  winner: string | null;
  endsAt: number; // when the running timer ends, in the HOST's clock (0 = none)
  remainingMs: number; // filled in when the state is saved, so every phone can count down
  // SECRET, host only (never saved): uid -> cells of the battleships still afloat.
  ships: Record<string, number[]>;
};

export type Move = { uid: string; rev: number; kind: 'place' | 'shoot'; cells?: number[]; cell?: number };

// ------------------------------------------------------------ cells ----
export const cellName = (cell: number) => `${String.fromCharCode(65 + Math.floor(cell / GRID))}${(cell % GRID) + 1}`;

export const isCell = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < CELL_COUNT;

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

// A placement the host accepts: the distinct valid cells of the player's choice (at most
// SHIP_COUNT, in the order given), topped up at random (the same on every call) to SHIP_COUNT.
export function sanitizePlacement(cells: unknown, seed: string, uid: string): number[] {
  const chosen: number[] = [];
  if (Array.isArray(cells)) {
    for (const c of cells) if (isCell(c) && !chosen.includes(c) && chosen.length < SHIP_COUNT) chosen.push(c);
  }
  if (chosen.length < SHIP_COUNT) {
    const rest = shuffled(
      Array.from({ length: CELL_COUNT }, (_, i) => i).filter((i) => !chosen.includes(i)),
      makeRng(`${seed}:fill:${uid}`)
    );
    chosen.push(...rest.slice(0, SHIP_COUNT - chosen.length));
  }
  return chosen.sort((a, b) => a - b);
}

// ------------------------------------------------------------ state ----
function edit(s: State): State {
  const c: State = JSON.parse(JSON.stringify(s));
  c.ver = s.ver + 1;
  return c;
}

export function newGame(order: string[], seed: string, now: number): State {
  return {
    ver: 1,
    rev: 0,
    seed,
    order: order.slice(),
    turnOrder: shuffleOrder(order, seed),
    cursor: -1,
    phase: 'placing',
    placed: [],
    out: [],
    shipsLeft: Object.fromEntries(order.map((id) => [id, SHIP_COUNT])),
    bullets: Object.fromEntries(order.map((id) => [id, BULLETS])),
    destroyed: Object.fromEntries(order.map((id) => [id, [] as number[]])),
    shots: [],
    current: null,
    turn: 0,
    winner: null,
    endsAt: now + PLACE_MS,
    remainingMs: PLACE_MS,
    ships: Object.fromEntries(order.map((id) => [id, [] as number[]])),
  };
}

// What is saved for everybody: the state without the secret ship positions.
export function publicState(s: State): State {
  return { ...s, ships: {} };
}

// Host restart: put the secret ships back into a saved state, from the placement moves that are
// still in the lobby (the first one of each player that was accepted) minus the sunk cells.
export function withShips(s: State, moves: { uid: string; kind: string; cells?: number[]; at?: number }[]): State {
  const c: State = JSON.parse(JSON.stringify(s));
  c.ships = {};
  for (const id of c.order) {
    if (c.out.includes(id) || c.shipsLeft[id] === 0) {
      c.ships[id] = [];
      continue;
    }
    const first = moves
      .filter((m) => m.uid === id && m.kind === 'place')
      .sort((a, b) => (a.at ?? 0) - (b.at ?? 0))[0];
    const base = sanitizePlacement(c.placed.includes(id) ? first?.cells : [], c.seed, id);
    c.ships[id] = base.filter((cell) => !c.destroyed[id].includes(cell));
  }
  return c;
}

export const shotCells = (s: State) => s.shots.filter((x) => x.cell !== null).map((x) => x.cell as number);

// Players who still have a battleship afloat.
export const afloat = (s: State) => s.order.filter((id) => s.shipsLeft[id] > 0 && !s.out.includes(id));

// Players who can still shoot.
const shooters = (s: State) => afloat(s).filter((id) => s.bullets[id] > 0);

// Who wins: the only player with a battleship; if nobody can shoot any more, the most battleships,
// then the most bullets; a tie for the top (or nobody afloat) is a draw.
function leader(s: State): string | null {
  const a = afloat(s);
  if (a.length === 0) return null;
  if (a.length === 1) return a[0];
  const best = a.reduce((top, id) => {
    const t = [s.shipsLeft[top], s.bullets[top]];
    const c = [s.shipsLeft[id], s.bullets[id]];
    return c[0] > t[0] || (c[0] === t[0] && c[1] > t[1]) ? id : top;
  }, a[0]);
  const same = a.filter((id) => s.shipsLeft[id] === s.shipsLeft[best] && s.bullets[id] === s.bullets[best]);
  return same.length === 1 ? best : null;
}

function endGame(s: State) {
  s.phase = 'over';
  s.winner = leader(s);
  s.current = null;
  s.endsAt = 0;
  s.rev += 1;
}

// Is the game over? (one player left with a battleship, nobody can shoot, or no free cell)
function isOver(s: State): boolean {
  return afloat(s).length <= 1 || shooters(s).length === 0 || shotCells(s).length >= CELL_COUNT;
}

// The next player (in turn order) who still has a battleship and a bullet.
function startTurn(s: State, now: number) {
  const n = s.turnOrder.length;
  for (let i = 1; i <= n; i++) {
    const idx = (s.cursor + i) % n;
    const id = s.turnOrder[idx];
    if (shooters(s).includes(id)) {
      s.cursor = idx;
      s.current = id;
      s.turn += 1;
      s.phase = 'aiming';
      s.endsAt = now + TURN_MS;
      s.rev += 1;
      return;
    }
  }
  endGame(s);
}

function beginBattle(s: State, now: number) {
  // The host fills in the placements nobody sent (or that were too late).
  for (const id of s.order) {
    if (s.out.includes(id)) continue;
    if (s.ships[id].length === 0) s.ships[id] = sanitizePlacement([], s.seed, id);
  }
  s.phase = 'countdown';
  s.endsAt = now + COUNTDOWN_MS;
  s.rev += 1;
}

// Shoot `cell` as `uid`: sink the ships on it and record the shot.
function fire(s: State, uid: string, cell: number | null, now: number) {
  const shot: Shot = {
    n: s.shots.length + 1,
    by: uid,
    cell,
    outcome: 'timeout',
    victims: [],
    lostBullet: true,
    out: [],
  };
  if (cell !== null) {
    const owners = s.order.filter((id) => s.ships[id].includes(cell));
    shot.victims = owners.filter((id) => id !== uid);
    const own = owners.includes(uid);
    shot.outcome = shot.victims.length > 0 ? (own ? 'neutral' : 'hit') : own ? 'own' : 'miss';
    shot.lostBullet = shot.victims.length === 0;
    for (const id of owners) {
      s.ships[id] = s.ships[id].filter((c) => c !== cell);
      s.destroyed[id].push(cell);
      s.shipsLeft[id] = s.ships[id].length;
      if (s.shipsLeft[id] === 0) shot.out.push(id);
    }
  }
  if (shot.lostBullet) s.bullets[uid] = Math.max(0, s.bullets[uid] - 1);
  s.shots.push(shot);
  s.phase = 'result';
  s.endsAt = now + RESULT_MS;
  s.rev += 1;
}

// ------------------------------------------------------------ moves ----
export function apply(state: State, move: Move, now: number): State {
  if (state.phase === 'over' || !state.order.includes(move.uid) || state.out.includes(move.uid)) return state;

  if (move.kind === 'place') {
    // Only the first placement of a player counts, and only while the ships are being placed.
    if (state.phase !== 'placing' || state.placed.includes(move.uid)) return state;
    const s = edit(state);
    s.placed.push(move.uid);
    s.ships[move.uid] = sanitizePlacement(move.cells, s.seed, move.uid);
    return s;
  }

  // shoot
  if (move.rev !== state.rev || state.phase !== 'aiming' || move.uid !== state.current) return state;
  if (!isCell(move.cell) || shotCells(state).includes(move.cell)) return state;
  const s = edit(state);
  fire(s, move.uid, move.cell, now);
  return s;
}

// ----------------------------------------------------------- timers ----
// A player who forfeited the game is out at once: their battleships go, and they do not shoot.
function dropPlayer(state: State, uid: string, now: number): State {
  const s = edit(state);
  const wasCurrent = s.current === uid;
  s.out.push(uid);
  s.ships[uid] = [];
  s.shipsLeft[uid] = 0;
  s.bullets[uid] = 0;
  if (s.phase === 'over') return s;
  if (s.phase !== 'placing' && isOver(s)) {
    endGame(s);
    return s;
  }
  if (s.phase === 'placing' && afloat(s).length <= 1) {
    endGame(s);
    return s;
  }
  // Their turn is cancelled. (During the result the shot is already done, so nothing else to do.)
  if (wasCurrent && s.phase === 'aiming') startTurn(s, now);
  return s;
}

// Call a few times per second on the host. `left` = players who forfeited the game.
export function tick(state: State, now: number, left: string[] = []): State {
  if (state.phase === 'over') return state;
  for (const id of left) if (state.order.includes(id) && !state.out.includes(id)) return dropPlayer(state, id, now);

  if (state.phase === 'placing') {
    const waiting = state.order.filter((id) => !state.out.includes(id) && !state.placed.includes(id));
    if (waiting.length > 0 && now < state.endsAt + PLACE_GRACE_MS) return state;
    const s = edit(state);
    beginBattle(s, now);
    return s;
  }

  if (state.endsAt === 0 || now < state.endsAt) return state;
  const s = edit(state);
  switch (state.phase) {
    case 'countdown':
      startTurn(s, now);
      break;
    case 'aiming':
      fire(s, state.current!, null, now); // too slow: -1 bullet
      break;
    case 'result':
      if (isOver(s)) endGame(s);
      else startTurn(s, now);
      break;
  }
  return s;
}

export const remainingNow = (state: State, receivedAt: number, now: number) =>
  Math.max(0, state.remainingMs - (now - receivedAt));
