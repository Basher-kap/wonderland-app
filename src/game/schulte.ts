// Schulte Table (Shurute Hyou): pure level logic, no React, no Firebase.
// Drop into app/src/game/ and test with the same tsc + node flow as engine.ts.

export type Cell = { id: number; label: string; value: number };

export const LEVEL_COUNT = 5;

// Level 4: the numbers are re-arranged every 10 seconds, while the player is still tapping.
export const SHUFFLE_LEVEL = 4;
export const SHUFFLE_MS = 10000;

// Small deterministic RNG (mulberry32) so every player gets the SAME first grid
// for a level when they use the same seed (e.g. `${matchId}:${roundNo}:L${level}`).
export function makeRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickDistinct(min: number, max: number, count: number, rnd: () => number): number[] {
  const pool: number[] = [];
  for (let n = min; n <= max; n++) pool.push(n);
  return shuffle(pool, rnd).slice(0, count);
}

// Equation whose answer is exactly `answer` (1-25), basic + - x.
function equationFor(answer: number, rnd: () => number): string {
  let kind = Math.floor(rnd() * 3);
  if (kind === 0 && answer < 2) kind = 1; // no "0 + 1"; use a subtraction instead
  if (kind === 0) {
    const a = Math.floor(rnd() * answer); // 0..answer-1
    return `${a} + ${answer - a}`;
  }
  if (kind === 1) {
    const b = 1 + Math.floor(rnd() * 20);
    return `${answer + b} - ${b}`;
  }
  const divisors: number[] = [];
  for (let d = 1; d <= answer; d++) if (answer % d === 0) divisors.push(d);
  const d = divisors[Math.floor(rnd() * divisors.length)];
  return `${d} x ${answer / d}`;
}

// Level specifications:
//   1: all numbers 1-25 in 25 cells, tapped ascending
//   2: numbers 1-25 in 25 cells, tapped DESCENDING (25 down to 1)
//   3: 25 random numbers from 1-99, ascending
//   4: numbers 1-30 in 30 cells, ascending, and the cells SHUFFLE every SHUFFLE_MS (10 s)
//   5: 25 equations whose answers are 1-25, tapped in ascending order of their answers
// Picking 25 different numbers out of 1-25 (level 2) or 30 out of 1-30 (level 4) takes all of
// them, so those levels differ from level 1 only by their order / size.
export type Direction = 'asc' | 'desc';

export const levelDirection = (level: number): Direction => (level === 2 ? 'desc' : 'asc');

// The cells of a level (the set of things to tap), in no particular order.
// Uses `seed` so the same seed gives the same set for everyone.
export function levelCells(level: number, seed: string): Cell[] {
  const rnd = makeRng(`${seed}:set`);
  const plain = (min: number, max: number, count: number): Cell[] =>
    pickDistinct(min, max, count, rnd).map((n) => ({ id: n, label: String(n), value: n }));
  switch (level) {
    case 1:
      return plain(1, 25, 25);
    case 2:
      return plain(1, 25, 25);
    case 3:
      return plain(1, 99, 25);
    case 4:
      return plain(1, 30, 30);
    case 5: {
      // 25 cells, answers are 1..25 once each, shown as equations.
      const answers = pickDistinct(1, 25, 25, rnd);
      return answers.map((n) => ({ id: n, label: equationFor(n, rnd), value: n }));
    }
    default:
      throw new Error(`Unknown Schulte level ${level}`);
  }
}

// Grid layout: the same cells in a random order. `arrangeSeed` changes on every shuffle (level 4).
export function arrange(cells: Cell[], arrangeSeed: string): Cell[] {
  return shuffle(cells, makeRng(`${arrangeSeed}:arrange`));
}

// 25 and 30 cells fit 5 columns (5 and 6 rows).
export const GRID_COLUMNS = 5;

// The values in the order they must be tapped (ascending, or descending on level 2).
export function tapOrder(cells: Cell[], level: number): number[] {
  const asc = cells.map((c) => c.value).sort((a, b) => a - b);
  return levelDirection(level) === 'desc' ? asc.reverse() : asc;
}

export type TapResult = 'correct' | 'wrong' | 'levelDone';

export function tap(cells: Cell[], tapped: number, value: number, level: number): TapResult {
  if (value !== tapOrder(cells, level)[tapped]) return 'wrong';
  return tapped + 1 === cells.length ? 'levelDone' : 'correct';
}

// Winner: finished all levels with the shortest total time. Unfinished players lose to finishers.
export type Result = { uid: string; finished: boolean; totalMs: number };

export function pickWinner(results: Result[]): string | null {
  const done = results.filter((r) => r.finished).sort((a, b) => a.totalMs - b.totalMs);
  if (done.length === 0) return null;
  if (done.length > 1 && done[0].totalMs === done[1].totalMs) return null; // exact tie = no winner
  return done[0].uid;
}
