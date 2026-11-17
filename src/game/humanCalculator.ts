// Human Calculator rules, with no screen code so they can be tested without a phone.
//
// One question = a short run of terms ("+5", "-2", "x2", "/5") shown one at a time. The player adds
// them up from left to right (starting from 0) and types the result within ANSWER_MS.
// A wrong or missing answer costs a chance. Out of chances = eliminated. Last player standing wins.
//
// Every phone builds the SAME question from the same seed, so nothing but the answers has to be sent.
import { makeRng } from './schulte';

export const START_CHANCES = 3;
export const MAX_QUESTIONS = 20; // safety cap so a lobby of good calculators cannot play forever
export const ANSWER_MS = 5000; // time to answer once the last term has disappeared
export const REVEAL_MS = 4000; // everybody's answers + the correct one are shown for this long
export const READY_MS = 3000; // "get ready" before the next question
export const GAP_MS = 250; // blank time between two terms so the same number twice is still noticed
export const AUTO_SUBMIT_TYPED = true; // an answer typed but not sent is sent when the time is up

export type Op = '+' | '-' | 'x' | '/';
export type Term = { op: Op; n: number };
export type Question = {
  q: number; // 1-based
  stage: number; // 1..4, how hard it is
  terms: Term[];
  answer: number;
  showMs: number; // how long each term stays on the screen
};

// HIDDEN from the players: how long and how hard the questions get.
//   stage 1 (q1-3): only + and -, 4-5 terms
//   stage 2 (q4-6): adds x
//   stage 3 (q7-9): adds /, longer (up to 7) but with small numbers
//   stage 4 (q10+): up to 8 terms, a bit bigger numbers
const TERM_COUNTS = [4, 4, 5, 4, 5, 5, 5, 6, 7, 7, 8, 8];
const SHOW_MS = [0, 1100, 1000, 900, 800];
const CAPS = [0, 30, 60, 80, 200]; // the running total never goes above this
const ADD_MAX = [0, 9, 9, 9, 15];
const MUL_MAX = [0, 0, 4, 4, 6];
const DIV_MAX = [0, 0, 0, 4, 6];

export const stageOf = (q: number) => (q <= 3 ? 1 : q <= 6 ? 2 : q <= 9 ? 3 : 4);
export const termCountOf = (q: number) => TERM_COUNTS[q - 1] ?? 8;

export const symbolOf = (op: Op) => ({ '+': '+', '-': '−', x: '×', '/': '÷' })[op];
export const labelOf = (t: Term) => `${symbolOf(t.op)}${t.n}`;

export function apply(total: number, t: Term): number {
  switch (t.op) {
    case '+':
      return total + t.n;
    case '-':
      return total - t.n;
    case 'x':
      return total * t.n;
    default:
      return total / t.n;
  }
}

export const evaluate = (terms: Term[]) => terms.reduce(apply, 0);

function tryBuild(seed: string, q: number, attempt: number): Term[] {
  const stage = stageOf(q);
  const rng = makeRng(`${seed}:calc:${q}:${attempt}`);
  const int = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
  const count = termCountOf(q);
  const terms: Term[] = [{ op: '+', n: int(2, ADD_MAX[stage]) }];
  let total = terms[0].n;
  while (terms.length < count) {
    const ops: Op[] = ['+', '-'];
    if (stage >= 2) ops.push('x');
    if (stage >= 3) ops.push('/');
    // plus and minus stay the most common, x and / are the spice
    const roll = rng();
    const op: Op = stage === 1 ? (roll < 0.5 ? '+' : '-') : roll < 0.35 ? '+' : roll < 0.6 ? '-' : ops[int(2, ops.length - 1)];
    let t: Term | null = null;
    if (op === '+') {
      const n = int(1, ADD_MAX[stage]);
      if (total + n <= CAPS[stage]) t = { op, n };
    } else if (op === '-') {
      if (total > 1) t = { op, n: int(1, Math.min(ADD_MAX[stage], total - 1)) };
    } else if (op === 'x') {
      const n = int(2, MUL_MAX[stage]);
      if (total * n <= CAPS[stage]) t = { op, n };
    } else {
      const divisors: number[] = [];
      for (let d = 2; d <= DIV_MAX[stage]; d++) if (total % d === 0 && total / d >= 1) divisors.push(d);
      if (divisors.length > 0) t = { op, n: divisors[int(0, divisors.length - 1)] };
    }
    if (!t) {
      const n = int(1, ADD_MAX[stage]);
      t = total + n <= CAPS[stage] ? { op: '+', n } : { op: '-', n: Math.min(n, total - 1) || 1 };
      if (t.op === '-' && total <= 1) t = { op: '+', n: 1 };
    }
    total = apply(total, t);
    terms.push(t);
  }
  return terms;
}

const hasOp = (terms: Term[], op: Op) => terms.some((t) => t.op === op);

// The same seed and question number always give the same question, on every phone.
export function buildQuestion(seed: string, q: number): Question {
  const stage = stageOf(q);
  let terms = tryBuild(seed, q, 0);
  for (let attempt = 1; attempt < 60; attempt++) {
    const ok = (stage < 2 || hasOp(terms, 'x') || hasOp(terms, '/')) && (stage < 3 || hasOp(terms, '/'));
    if (ok) break;
    terms = tryBuild(seed, q, attempt);
  }
  return { q, stage, terms, answer: evaluate(terms), showMs: SHOW_MS[stage] };
}

// ---------------------------------------------------------------- standings

export type QuestionDoc = { uid: string; stage: number; solved: boolean; answer?: number };

export type Standings = {
  completed: number; // questions every living player has answered
  chances: Record<string, number>;
  alive: string[];
  lastQ: Record<string, number>; // question the player was eliminated at (completed count if still alive)
  gameOver: boolean;
  next: number; // the next question to play
};

// Replays the game from everybody's answers. Same input on every phone = same standings.
// `out` are players who forfeited: they are dead from the start and nobody waits for them.
export function standings(players: string[], out: string[], docs: QuestionDoc[]): Standings {
  const chances: Record<string, number> = {};
  const lastQ: Record<string, number> = {};
  for (const p of players) {
    chances[p] = out.includes(p) ? 0 : START_CHANCES;
    lastQ[p] = 0;
  }
  const byKey = new Map<string, QuestionDoc>();
  for (const d of docs) byKey.set(`${d.uid}:${d.stage}`, d);
  const solo = players.length <= 1;
  const living = () => players.filter((p) => chances[p] > 0);
  let completed = 0;
  let gameOver = living().length <= (solo ? 0 : 1);
  while (!gameOver && completed < MAX_QUESTIONS) {
    const q = completed + 1;
    const alive = living();
    if (!alive.every((p) => byKey.has(`${p}:${q}`))) break;
    for (const p of alive) {
      if (!byKey.get(`${p}:${q}`)!.solved) {
        chances[p] -= 1;
        if (chances[p] === 0) lastQ[p] = q;
      }
    }
    completed = q;
    gameOver = living().length <= (solo ? 0 : 1) || completed >= MAX_QUESTIONS;
  }
  const alive = living();
  for (const p of alive) lastQ[p] = completed;
  return { completed, chances, alive, lastQ, gameOver, next: completed + 1 };
}

// ------------------------------------------------------------------ results

// What one player reports when done: the more chances left the better, then the longer they lasted.
export const scoreFor = (chances: number, lastQ: number) => chances * 100 + lastQ;
export const chancesOfScore = (score: number) => Math.floor(score / 100);
export const questionOfScore = (score: number) => score % 100;

export type Result = { uid: string; finished: boolean; totalMs: number; forfeited?: boolean; score?: number };

// Highest score wins; a tie (for example everybody dropped out on the same question) is a draw.
export function pickWinner(results: Result[]): string | null {
  const rows = results.filter((r) => !r.forfeited);
  if (rows.length === 0) return null;
  const best = Math.max(...rows.map((r) => r.score ?? 0));
  const top = rows.filter((r) => (r.score ?? 0) === best);
  return top.length === 1 ? top[0].uid : null;
}

export function describeScore(score: number): string {
  const c = chancesOfScore(score);
  return c > 0 ? `${c} ${c === 1 ? 'chance' : 'chances'} left` : `out at question ${questionOfScore(score)}`;
}
