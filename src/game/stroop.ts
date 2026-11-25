// Stroop Effect: pure question logic, no React, no Firebase. Test with the same tsc + node flow as engine.ts.
//
// HIDDEN NOTES (NOT listed in data/games.ts on purpose, the players are not told):
//   - QUESTION_COUNT questions, the same list for every player (built from `seed` only).
//   - It gets harder as it goes: the time limit shrinks from 5 s to 2.5 s, the word matches its own
//     color less and less often, from question 11 two more colors (purple, orange) join the four and
//     the answer buttons change places every question.
//   - A player answers at their own pace; the round ends when everybody has finished. The highest
//     score wins; a tie goes to the lower total time (unanswered questions count their full limit).
import { makeRng } from './schulte';

export const QUESTION_COUNT = 20;
export const START_LIMIT_MS = 5000;
export const MIN_LIMIT_MS = 2500;
export const FEEDBACK_MS = 700; // how long "correct / wrong" stays before the next question
export const BASE_COLORS = 4;
export const HARD_FROM = 10; // index of the first question with 6 colors and shuffled buttons

export type ColorId = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';
export const COLOR_IDS: readonly ColorId[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
export const COLOR_NAME: Record<ColorId, string> = {
  red: 'RED',
  blue: 'BLUE',
  green: 'GREEN',
  yellow: 'YELLOW',
  purple: 'PURPLE',
  orange: 'ORANGE',
};

export type Question = {
  word: ColorId; // what the word says
  ink: ColorId; // the color it is written in: the right answer
  options: ColorId[]; // the buttons, in order
  limitMs: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const limitFor = (i: number) => Math.round(lerp(START_LIMIT_MS, MIN_LIMIT_MS, i / (QUESTION_COUNT - 1)) / 100) * 100;
// The chance the word and its ink match: 35 % at the start, 8 % at the end.
const sameChance = (i: number) => lerp(0.35, 0.08, i / (QUESTION_COUNT - 1));

export function buildQuestions(seed: string): Question[] {
  const rnd = makeRng(`${seed}:stroop`);
  const out: Question[] = [];
  for (let i = 0; i < QUESTION_COUNT; i++) {
    const pool = COLOR_IDS.slice(0, i < HARD_FROM ? BASE_COLORS : COLOR_IDS.length);
    let ink = pool[Math.floor(rnd() * pool.length)];
    // the same answer never comes up three times in a row
    const a = out[i - 1]?.ink;
    const b = out[i - 2]?.ink;
    while (a && b && ink === a && ink === b) ink = pool[Math.floor(rnd() * pool.length)];
    let word = ink;
    if (rnd() >= sameChance(i)) {
      const others = pool.filter((c) => c !== ink);
      word = others[Math.floor(rnd() * others.length)];
    }
    let options = pool.slice();
    if (i >= HARD_FROM) {
      for (let k = options.length - 1; k > 0; k--) {
        const j = Math.floor(rnd() * (k + 1));
        [options[k], options[j]] = [options[j], options[k]];
      }
    }
    out.push({ word, ink, options, limitMs: limitFor(i) });
  }
  return out;
}

// 1 point for the right color, 0 for a wrong one or for no answer (null).
export const judge = (q: Question, picked: ColorId | null): boolean => picked !== null && picked === q.ink;

export type Answer = { picked: ColorId | null; ms: number };

// Score and total time of a finished game. A missed question counts its whole time limit.
export function summarize(questions: Question[], answers: Answer[]) {
  let score = 0;
  let totalMs = 0;
  answers.forEach((a, i) => {
    const q = questions[i];
    if (!q) return;
    if (judge(q, a.picked)) score += 1;
    totalMs += a.picked === null ? q.limitMs : Math.max(0, Math.min(q.limitMs, a.ms));
  });
  return { score, totalMs };
}

type Row = { uid: string; finished: boolean; totalMs: number; forfeited?: boolean; score?: number };

// The highest score wins, a tie goes to the lower total time, a tie on both is a draw (null).
// Players who forfeited or did not finish cannot win.
export function pickWinner(results: Row[]): string | null {
  const rows = results.filter((r) => r.finished && !r.forfeited);
  if (rows.length === 0) return null;
  const best = rows.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.totalMs - b.totalMs);
  const top = best[0];
  const tied = best.filter((r) => (r.score ?? 0) === (top.score ?? 0) && r.totalMs === top.totalMs);
  return tied.length > 1 ? null : top.uid;
}

export const describeScore = (r: Row) => (r.finished ? `${r.score ?? 0} of ${QUESTION_COUNT} correct` : 'did not finish');
