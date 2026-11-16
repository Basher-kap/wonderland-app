// Wordle ("Waadoru"): pure rules, no React, no Firebase.
// Test with test/wordle.test.cjs (same tsc + node flow as the other tests).
//
// The game has 3 levels: an easy word, a moderate word and a hard word. Every player has 5 attempts
// per word. A level ends when ALL players are done with it (guessed, or used 5 attempts); then the
// answer is shown to everybody, and the next level starts when all players are ready.
// Points: every correct word earns points by LEVEL (attempts do not matter).

import { EASY_WORDS, HARD_WORDS, MODERATE_WORDS, VALID_WORDS } from '../data/wordleWords';
import { makeRng } from './schulte';

export const WORD_LENGTH = 5;
export const MAX_ATTEMPTS = 5;
export const LEVEL_COUNT = 3;

export type LetterState = 'green' | 'yellow' | 'gray';

const LEVEL_WORDS = [EASY_WORDS, MODERATE_WORDS, HARD_WORDS];
export const LEVEL_NAMES = ['Easy', 'Moderate', 'Hard'];

// Points for guessing the word of a level: easy +5, moderate +10, hard +20. Flat: NOT multiplied
// by the game's difficulty. They are NOT shown on the game screen or in the rules window.
// The most a player can earn in one game is MAX_EXTRA (= the sum); src/game/engine.ts and
// backend/firestore.rules repeat that number, so change them together.
export const LEVEL_POINTS = [5, 10, 20];
export const MAX_EXTRA = 35;

// The hidden word of a level (1, 2 or 3). Same seed (matchId + round number) and level = same
// word on every phone. The three lists share no word, so a game never repeats a word.
export function pickAnswer(seed: string, level: number): string {
  const words = LEVEL_WORDS[level - 1];
  if (!words) throw new Error(`Unknown Wordle level ${level}`);
  const rnd = makeRng(`${seed}:wordle:L${level}`);
  return words[Math.floor(rnd() * words.length)];
}

// A guess must be 5 letters from the word list. Anything else is not allowed (the Prohibition).
export const normalizeGuess = (raw: string) => raw.trim().toLowerCase();
export const isValidWord = (raw: string) => VALID_WORDS.has(normalizeGuess(raw));

// Colour of every letter of a guess. Greens first, then yellows from the letters that are left,
// so a repeated letter is never yellow more times than it appears in the hidden word.
export function scoreGuess(guess: string, answer: string): LetterState[] {
  const g = normalizeGuess(guess);
  const a = answer.toLowerCase();
  const result: LetterState[] = Array(g.length).fill('gray');
  const left: Record<string, number> = {};
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) result[i] = 'green';
    else left[a[i]] = (left[a[i]] ?? 0) + 1;
  }
  for (let i = 0; i < g.length; i++) {
    if (result[i] === 'green') continue;
    if ((left[g[i]] ?? 0) > 0) {
      result[i] = 'yellow';
      left[g[i]] -= 1;
    }
  }
  return result;
}

// Best colour seen so far for each letter (for the keyboard): green beats yellow beats gray.
export function keyStates(guesses: string[], answer: string): Record<string, LetterState> {
  const rank: Record<LetterState, number> = { gray: 0, yellow: 1, green: 2 };
  const out: Record<string, LetterState> = {};
  for (const guess of guesses) {
    const g = normalizeGuess(guess);
    scoreGuess(g, answer).forEach((state, i) => {
      const prev = out[g[i]];
      if (prev === undefined || rank[state] > rank[prev]) out[g[i]] = state;
    });
  }
  return out;
}

// What a player did in each finished level (index 0 = level 1).
export type Outcome = { solved: boolean; ms: number };

// The player's final numbers for the game: points, and the total time of the words they guessed
// (used only to break a tie between players with the same points).
export function tally(outcomes: Outcome[]): { score: number; totalMs: number } {
  let score = 0;
  let totalMs = 0;
  outcomes.forEach((o, i) => {
    if (o && o.solved) {
      score += LEVEL_POINTS[i] ?? 0;
      totalMs += Math.max(0, Math.round(o.ms));
    }
  });
  return { score, totalMs };
}

// How many words a score stands for. Every combination of 5 / 10 / 20 adds up to a different
// number, so the score tells which levels were guessed (for the round summary).
export function solvedCount(score: number): number {
  let n = 0;
  for (let mask = 0; mask < 1 << LEVEL_POINTS.length; mask++) {
    let sum = 0;
    let bits = 0;
    LEVEL_POINTS.forEach((p, i) => {
      if (mask & (1 << i)) {
        sum += p;
        bits++;
      }
    });
    if (sum === score) n = bits;
  }
  return n;
}

// The winner has the most points. Same points: the shorter total time wins. Nobody scored,
// or still tied: nobody wins (a draw). A player who forfeited the game never wins.
export type Result = { uid: string; finished: boolean; totalMs: number; score?: number; forfeited?: boolean };

export function pickWinner(results: Result[]): string | null {
  const ranked = results
    .filter((r) => !r.forfeited)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.totalMs - b.totalMs);
  if (ranked.length === 0 || (ranked[0].score ?? 0) <= 0) return null;
  if (ranked.length > 1) {
    const [x, y] = ranked;
    if ((x.score ?? 0) === (y.score ?? 0) && x.totalMs === y.totalMs) return null;
  }
  return ranked[0].uid;
}

// Points a player earns from this game, whether or not they win it (0 if they forfeited).
export const extraPoints = (r: Result): number =>
  r.forfeited ? 0 : Math.min(MAX_EXTRA, Math.max(0, Math.round(r.score ?? 0)));
