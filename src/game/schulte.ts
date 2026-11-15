// Schulte Table (Shurute Hyou): pure level logic, no React, no Firebase.
// Drop into app/src/game/ and test with the same tsc + node flow as engine.ts.

export type Cell = { id: number; label: string; value: number };

export const LEVEL_COUNT = 5;

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

// Equation whose answer is exactly `answer` (1-30), basic + - x.
function equationFor(answer: number, rnd: () => number): string {
  const kind = Math.floor(rnd() * 3);
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

// The cells of a level (the set of things to tap), in no particular order.
// Uses `seed` so the same seed gives the same set for everyone.
export function levelCells(level: number, seed: string): Cell[] {
  const rnd = makeRng(`${seed}:set`);
  switch (level) {
    case 1:
      return pickDistinct(1, 25, 25, rnd).map((n) => ({ id: n, label: String(n), value: n }));
    case 2:
      return pickDistinct(1, 50, 25, rnd).map((n) => ({ id: n, label: String(n), value: n }));
    case 3:
      return pickDistinct(100, 999, 25, rnd).map((n) => ({ id: n, label: String(n), value: n }));
    case 4:
      return pickDistinct(100, 999, 50, rnd).map((n) => ({ id: n, label: String(n), value: n }));
    case 5: {
      // 30 cells, answers are 1..30 once each, shown as equations.
      const answers = pickDistinct(1, 30, 30, rnd);
      return answers.map((n) => ({ id: n, label: equationFor(n, rnd), value: n }));
    }
    default:
      throw new Error(`Unknown Schulte level ${level}`);
  }
}

// Grid layout: the same cells in a random order. `arrangeSeed` changes on every wrong tap.
export function arrange(cells: Cell[], arrangeSeed: string): Cell[] {
  return shuffle(cells, makeRng(`${arrangeSeed}:arrange`));
}

// 25 and 30 cells fit 5 columns; 50 cells use 5 columns of 10 rows (scroll or shrink cells on small phones).
export const GRID_COLUMNS = 5;

// Tap order: ascending by value. Returns the value that must be tapped next.
export function nextTarget(cells: Cell[], tapped: number): number {
  const sorted = cells.map((c) => c.value).sort((a, b) => a - b);
  return sorted[tapped];
}

export type TapResult = 'correct' | 'wrong' | 'levelDone';

export function tap(cells: Cell[], tapped: number, value: number): TapResult {
  if (value !== nextTarget(cells, tapped)) return 'wrong';
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
