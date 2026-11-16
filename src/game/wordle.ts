// Wordle ("Waadoru"): pure rules, no React, no Firebase.
// Test with test/wordle.test.cjs (same tsc + node flow as the other tests).

import { ANSWERS, VALID_WORDS } from '../data/wordleWords';
import { makeRng } from './schulte';

export const WORD_LENGTH = 5;
export const MAX_ATTEMPTS = 5;

export type LetterState = 'green' | 'yellow' | 'gray';

// The hidden word. Same seed (matchId + round number) = same word on every phone.
export function pickAnswer(seed: string): string {
  const rnd = makeRng(`${seed}:wordle`);
  return ANSWERS[Math.floor(rnd() * ANSWERS.length)];
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

// Extra points for the winner, by the number of attempts used. NOT shown on the game screen.
// Not multiplied by the difficulty (a flat bonus on top of the normal win points).
const BONUS_BY_ATTEMPT = [10, 8, 5, 2, 0];
export const MAX_BONUS = 10; // repeated in engine.ts and in backend/firestore.rules
export const bonusFor = (attempts: number): number =>
  Number.isInteger(attempts) && attempts >= 1 && attempts <= MAX_ATTEMPTS ? BONUS_BY_ATTEMPT[attempts - 1] : 0;

// The game ends as soon as the first player guesses the word, so the winner is the earliest
// solver (shortest time on their own clock; the 3-2-1 start is shared). Nobody solved = draw.
export type Result = { uid: string; finished: boolean; totalMs: number; attempts?: number; forfeited?: boolean };

export function pickWinner(results: Result[]): string | null {
  const solved = results
    .filter((r) => r.finished && !r.forfeited)
    .sort((a, b) => a.totalMs - b.totalMs || (a.attempts ?? MAX_ATTEMPTS) - (b.attempts ?? MAX_ATTEMPTS));
  if (solved.length === 0) return null;
  if (solved.length > 1) {
    const [x, y] = solved;
    if (x.totalMs === y.totalMs && (x.attempts ?? MAX_ATTEMPTS) === (y.attempts ?? MAX_ATTEMPTS)) return null;
  }
  return solved[0].uid;
}

// The round is over as soon as somebody solved it, or when everybody is done.
export const roundIsOver = (results: Result[], playerCount: number): boolean =>
  results.some((r) => r.finished && !r.forfeited) || results.length >= playerCount;
