// Color Territory: pure rules, no React, no Firebase.
//
// About CELLS white circles sit on the screen. Every player is secretly given a colour (a "kingdom")
// at random and taps circles to dye them. A tap claims a white circle AND steals a circle that is
// already claimed: the circle belongs to whoever tapped it LAST. When GAME_MS is over, the player who
// owns the most circles wins. A tie for the top is a draw (nobody wins).
//
// Like Fortune and Xibalba, the HOST's phone is the only one that runs the game. Players send "moves"
// (tap circle N) as their own documents; the host folds them into the board and saves the whole game
// as the single document "state". The board is FOLDED from all the moves of the play phase every time
// (the owner of a circle = the player of its newest move, by server time), so applying the same move
// twice, or applying them again after the host's phone restarted, can never change the result.
//
// A game has three phases: 'ready' (everybody sees which kingdom they were given, nobody can tap
// yet), 'play' (the clock runs) and 'over'. `rev` goes up on every phase change and a move only
// counts if it was made for the 'play' phase's rev, so taps made too early or too late are ignored.
//
// NOT shown to the players on purpose (hidden notes): the 2-minute limit is on the clock, but the
// "latest tap wins" rule, the tie being a draw and the number of circles are only described here.
import { makeRng } from './schulte';

// ----------------------------------------------------------- tuning ----
// 6 + 5 + 6 + 5 + 6 + 5 + 6 + 5 + 6 = 50 circles, in rows of a honeycomb (see layoutFor).
export const ROW_SIZES: readonly number[] = [6, 5, 6, 5, 6, 5, 6, 5, 6];
export const CELLS = ROW_SIZES.reduce((a, b) => a + b, 0);
export const GAME_MS = 120000; // the time limit
export const READY_MS = 5000; // the time to look at your kingdom before the clock starts
export const KINGDOMS = 8; // distinct colours (= the most players in a lobby, see MAX_PLAYERS)

export const NO_OWNER = -1;

// ------------------------------------------------------------ layout ----
// Where each circle sits, as fractions (0..1) of the board's width and height. Same seed = same
// board on every phone. The honeycomb is nudged a little so it looks hand-scattered, never so much
// that two circles can touch.
export type Spot = { x: number; y: number };

export function layoutFor(seed: string): Spot[] {
  const rnd = makeRng(`${seed}:territory:layout`);
  const rows = ROW_SIZES.length;
  const wide = Math.max(...ROW_SIZES); // 6 columns in the widest rows
  const spots: Spot[] = [];
  ROW_SIZES.forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      // The wide rows use every column slot; the short rows sit between them.
      const slot = n === wide ? i : i + 0.5;
      const jx = (rnd() - 0.5) * 0.1; // a fraction of one column / row step
      const jy = (rnd() - 0.5) * 0.1;
      spots.push({
        x: (slot + 0.5 + jx) / wide,
        y: (r + 0.5 + jy) / rows,
      });
    }
  });
  return spots;
}

// ------------------------------------------------------------ kingdoms ----
// A random colour slot (0..KINGDOMS-1) for every player, the same on every phone.
export function assignSlots(playerIds: string[], seed: string): Record<string, number> {
  const rnd = makeRng(`${seed}:territory:slots`);
  const slots = Array.from({ length: KINGDOMS }, (_, i) => i);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const out: Record<string, number> = {};
  playerIds.forEach((id, i) => {
    out[id] = slots[i % KINGDOMS];
  });
  return out;
}

// ------------------------------------------------------------- state ----
export type Phase = 'ready' | 'play' | 'over';

export type State = {
  ver: number; // goes up on every change (the host saves when it changes)
  rev: number; // goes up on every phase change (moves are made for one rev)
  seed: string;
  order: string[]; // everybody, fixed order for the screen
  slots: number[]; // slots[i] = the kingdom (colour) of order[i]
  phase: Phase;
  // owners[cell] = index into `order` of the player who owns the circle, or NO_OWNER (white).
  owners: number[];
  endsAt: number; // when the running timer ends, in the HOST's clock (0 = none)
  remainingMs: number; // filled in when the state is saved, so every phone can count down
  winner: string | null; // set when the game is over; null = a draw
  counts: number[]; // counts[i] = circles owned by order[i] (kept up to date for every phone)
};

// One tap. `id` is the move's document id, `at` its server time in ms (an estimate until the server
// has confirmed it); two taps in the same millisecond are ordered by id.
export type Move = { id: string; uid: string; rev: number; cell: number; at: number };

export const isValidCell = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < CELLS;

// The play phase's rev: moves only count for this one (ready = 1, play = 2, over = 3).
export const PLAY_REV = 2;

function edit(s: State): State {
  const c: State = JSON.parse(JSON.stringify(s));
  c.ver = s.ver + 1;
  return c;
}

export function countsOf(owners: number[], players: number): number[] {
  const out = Array.from({ length: players }, () => 0);
  for (const o of owners) if (o >= 0 && o < players) out[o] += 1;
  return out;
}

export const unclaimedOf = (s: State) => s.owners.filter((o) => o === NO_OWNER).length;

export function newGame(order: string[], seed: string, now: number): State {
  const slotOf = assignSlots(order, seed);
  return {
    ver: 1,
    rev: 1,
    seed,
    order: order.slice(),
    slots: order.map((id) => slotOf[id]),
    phase: 'ready',
    owners: Array.from({ length: CELLS }, () => NO_OWNER),
    endsAt: now + READY_MS,
    remainingMs: READY_MS,
    winner: null,
    counts: order.map(() => 0),
  };
}

// ------------------------------------------------------------ moves ----
// Rebuild the board from every tap of the play phase: a circle belongs to whoever tapped it last.
// Returns the SAME state object when nothing changed, so the host only saves real changes.
export function applyMoves(state: State, moves: Move[]): State {
  if (state.phase !== 'play') return state;
  const index = new Map(state.order.map((id, i) => [id, i]));
  const owners = Array.from({ length: CELLS }, () => NO_OWNER);
  const valid = moves
    .filter((m) => m.rev === state.rev && isValidCell(m.cell) && index.has(m.uid))
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const m of valid) owners[m.cell] = index.get(m.uid)!;
  if (owners.every((o, i) => o === state.owners[i])) return state;
  const s = edit(state);
  s.owners = owners;
  s.counts = countsOf(owners, s.order.length);
  return s;
}

// ----------------------------------------------------------- timers ----
// Who owns the most circles. null = nobody (a tie for the top, or nobody owns anything).
export function winnerOf(s: Pick<State, 'order' | 'counts'>): string | null {
  const best = Math.max(0, ...s.counts);
  if (best === 0) return null;
  const top = s.counts.map((c, i) => (c === best ? i : -1)).filter((i) => i >= 0);
  return top.length === 1 ? s.order[top[0]] : null;
}

// Call a few times per second on the host (after applyMoves, so the last taps are in the final count).
export function tick(state: State, now: number): State {
  if (state.phase === 'over') return state;
  if (state.endsAt === 0 || now < state.endsAt) return state;
  const s = edit(state);
  s.rev += 1;
  if (state.phase === 'ready') {
    s.phase = 'play';
    s.endsAt = now + GAME_MS;
  } else {
    s.phase = 'over';
    s.endsAt = 0;
    s.counts = countsOf(s.owners, s.order.length);
    s.winner = winnerOf(s);
  }
  return s;
}

export const remainingNow = (state: State, receivedAt: number, now: number) =>
  Math.max(0, state.remainingMs - (now - receivedAt));

// "1:42"
export function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
