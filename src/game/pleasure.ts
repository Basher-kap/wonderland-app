// Pleasure: pure rules, no React, no Firebase.
//
// A variety-show quiz. A bear asks QUESTIONS_PER_GAME personal questions, one at a time ("What is
// your favorite food?"); every player answers privately. Then one player is drawn at random to be
// the HOST of the game (for all the questions). The questions come back one at a time and everybody
// EXCEPT the Host must pick, out of 4 choices, the answer the Host gave. One choice is the Host's
// answer; the other three are answers other players gave to the same question (so nobody can tell
// them apart by style). All answers are turned into small letters.
//
// CLEAR CONDITIONS (the text you gave), and how they are read here (change them in `finish`):
//  - A question is "uncovered" when at least one player picked the Host's real answer.
//  - If the players uncover HOST_WINS_AT or more of the questions, the Host wins the game.
//  - However, a player who guessed ALL the questions wins the game instead (if two players did, it
//    is a shared victory = a draw).
//  - Otherwise nobody wins (a draw).
//
// ROUND DETAILS (decisions, change them here):
//  - A guess is final: the first one a player locks in counts.
//  - A player who did not answer a question simply has no answer in the pool. If the Host did not
//    answer a question, that question is skipped (nobody can guess it, and it is not uncovered).
//  - If fewer than 3 other answers exist, the missing choices are silly stock answers
//    (data/pleasureQuestions.ts).
//  - A player who forfeits the game leaves at once; if the Host leaves, the game ends in a draw.
//
// Like Fortune and Xibalba, the HOST's phone (the lobby host, not the quiz Host) is the only one that
// runs the game: players send "moves" (an answer, a guess) and it applies them with `apply`, calls
// `tick` a few times per second for the timers and saves the state, which every phone shows. The
// answers, the right choice and the guesses stay on that phone (`publicState` strips them) until
// the reveal of each question.
import { makeRng } from './schulte';
import { FALLBACK_ANSWERS, QUESTIONS } from '../data/pleasureQuestions';

// ----------------------------------------------------------- tuning ----
export const QUESTIONS_PER_GAME = 5;
export const CHOICES = 4;
export const MAX_ANSWER = 50; // letters
export const HOST_WINS_AT = 4; // questions uncovered by the players
export const ASK_MS = 40000;
export const MIN_ASK_MS = 3000; // even if everybody has answered, a question lasts at least this long
export const DRAW_MS = 6500; // the roulette that picks the Host
export const DRAW_LANDS_MS = 4300; // ... it stops on the Host this long after it starts
export const GUESS_MS = 20000;
export const MIN_GUESS_MS = 2500;
export const REVEAL_MS = 7500;

export type Phase = 'ask' | 'draw' | 'guess' | 'reveal' | 'over';
export type Outcome = 'host' | 'player' | 'none';

export type Reveal = {
  q: number;
  question: string;
  skipped: boolean; // the Host gave no answer to this question
  choices: string[];
  correct: number; // index of the Host's real answer (-1 when skipped)
  authors: (string | null)[]; // who wrote each choice (null: a stock answer)
  picks: Record<string, number>; // player -> the choice they picked
  right: string[]; // the players who picked the Host's real answer
};

export type State = {
  ver: number; // goes up on every change (the host saves when it changes)
  rev: number; // goes up on every phase / question (moves are made for one rev)
  seed: string;
  order: string[]; // everybody
  gone: string[]; // players who forfeited the game
  questions: string[];
  phase: Phase;
  qi: number; // the question being asked or guessed (0-based)
  host: string | null; // the quiz Host, drawn after the last answer
  done: string[]; // who has answered / guessed in the current question (not WHAT)
  choices: string[]; // the 4 choices of the question being guessed
  reveal: Reveal | null;
  scores: Record<string, number>; // correct guesses per player
  uncovered: (boolean | null)[]; // per question: guessed by somebody? (null: not revealed yet)
  outcome: Outcome | null;
  winner: string | null;
  lastLeft: string | null;
  endsAt: number; // when the running timer ends, in the HOST's clock (0 = none)
  pickFrom: number; // when the current question started, in the HOST's clock
  remainingMs: number; // filled in when the state is saved, so every phone can count down
  // PHONE OF THE LOBBY HOST ONLY (empty in a saved state, see publicState).
  answers: Record<string, string>[]; // per question: player -> answer (small letters)
  seenAt: Record<string, number>; // the newest move already applied, per answer
  correct: number;
  authors: (string | null)[];
  guesses: Record<string, number>;
};

export type Move =
  | { kind: 'answer'; uid: string; rev: number; q: number; text: string; at: number }
  | { kind: 'guess'; uid: string; rev: number; q: number; choice: number; at: number };

export const publicState = (s: State): State => ({
  ...s,
  answers: s.questions.map(() => ({})),
  seenAt: {},
  correct: -1,
  authors: [],
  guesses: {},
});

// Everything a player typed, as it is kept: small letters, single spaces, at most MAX_ANSWER letters.
export function cleanAnswer(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, MAX_ANSWER)
    .trim();
}

function shuffled<T>(list: T[], rnd: () => number): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pickQuestions = (seed: string): string[] =>
  shuffled(QUESTIONS, makeRng(`${seed}:pleasure:questions`)).slice(0, QUESTIONS_PER_GAME);

export const presentOf = (s: Pick<State, 'order' | 'gone'>) => s.order.filter((id) => !s.gone.includes(id));
export const guessersOf = (s: Pick<State, 'order' | 'gone' | 'host'>) => presentOf(s).filter((id) => id !== s.host);

function edit(s: State): State {
  const c: State = JSON.parse(JSON.stringify(s));
  c.ver = s.ver + 1;
  return c;
}

function startAsk(s: State, now: number) {
  s.phase = 'ask';
  s.done = [];
  s.choices = [];
  s.reveal = null;
  s.pickFrom = now;
  s.endsAt = now + ASK_MS;
  s.rev += 1;
}

export function newGame(order: string[], seed: string, now: number): State {
  const s: State = {
    ver: 1,
    rev: 0,
    seed,
    order: order.slice(),
    gone: [],
    questions: pickQuestions(seed),
    phase: 'ask',
    qi: 0,
    host: null,
    done: [],
    choices: [],
    reveal: null,
    scores: Object.fromEntries(order.map((id) => [id, 0])),
    uncovered: Array.from({ length: QUESTIONS_PER_GAME }, () => null),
    outcome: null,
    winner: null,
    lastLeft: null,
    endsAt: 0,
    pickFrom: now,
    remainingMs: 0,
    answers: Array.from({ length: QUESTIONS_PER_GAME }, () => ({})),
    seenAt: {},
    correct: -1,
    authors: [],
    guesses: {},
  };
  startAsk(s, now);
  s.remainingMs = ASK_MS;
  return s;
}

// ------------------------------------------------------------ moves ----
export function apply(state: State, move: Move): State {
  if (move.rev !== state.rev || move.q !== state.qi) return state;
  if (!state.order.includes(move.uid) || state.gone.includes(move.uid)) return state;

  if (move.kind === 'answer') {
    if (state.phase !== 'ask') return state;
    const text = cleanAnswer(move.text);
    if (text === '') return state;
    const key = `${move.q}:${move.uid}`;
    if (move.at <= (state.seenAt[key] ?? 0)) return state;
    if (state.answers[move.q][move.uid] === text) return state;
    const s = edit(state);
    s.answers[move.q][move.uid] = text;
    s.seenAt[key] = move.at;
    if (!s.done.includes(move.uid)) s.done.push(move.uid);
    return s;
  }

  // A guess: only a player who is not the Host, only while guessing, and the first one is final.
  if (state.phase !== 'guess' || move.uid === state.host) return state;
  if (!Number.isInteger(move.choice) || move.choice < 0 || move.choice >= state.choices.length) return state;
  if (state.guesses[move.uid] !== undefined) return state;
  const s = edit(state);
  s.guesses[move.uid] = move.choice;
  if (!s.done.includes(move.uid)) s.done.push(move.uid);
  return s;
}

// ----------------------------------------------------------- phases ----
function drawHost(s: State, now: number) {
  const present = presentOf(s);
  const rnd = makeRng(`${s.seed}:pleasure:host`);
  s.host = present[Math.floor(rnd() * present.length)];
  s.phase = 'draw';
  s.qi = 0;
  s.done = [];
  s.choices = [];
  s.endsAt = now + DRAW_MS;
  s.rev += 1;
}

// The 4 choices of the question: the Host's answer and 3 answers other players gave to it.
export function buildChoices(s: State): { choices: string[]; authors: (string | null)[]; correct: number } {
  const hostAnswer = s.answers[s.qi][s.host!];
  const rnd = makeRng(`${s.seed}:pleasure:choices:${s.qi}`);
  const seen = new Set<string>([hostAnswer]);
  const decoys: { text: string; by: string | null }[] = [];
  for (const id of shuffled(s.order.filter((p) => p !== s.host), rnd)) {
    const text = s.answers[s.qi][id];
    if (text && !seen.has(text)) {
      seen.add(text);
      decoys.push({ text, by: id });
    }
  }
  for (const text of shuffled(FALLBACK_ANSWERS, rnd)) {
    if (decoys.length >= CHOICES - 1) break;
    if (!seen.has(text)) {
      seen.add(text);
      decoys.push({ text, by: null });
    }
  }
  const all = shuffled([{ text: hostAnswer, by: s.host }, ...decoys.slice(0, CHOICES - 1)], rnd);
  return { choices: all.map((c) => c.text), authors: all.map((c) => c.by), correct: all.findIndex((c) => c.by === s.host) };
}

function startGuess(s: State, now: number) {
  s.guesses = {};
  s.done = [];
  if (!s.answers[s.qi][s.host!]) {
    // The Host gave no answer to this one: skip it.
    s.choices = [];
    s.authors = [];
    s.correct = -1;
    settle(s, now);
    return;
  }
  const b = buildChoices(s);
  s.choices = b.choices;
  s.authors = b.authors;
  s.correct = b.correct;
  s.phase = 'guess';
  s.pickFrom = now;
  s.endsAt = now + GUESS_MS;
  s.rev += 1;
}

// The time is up (or everybody has guessed): who got it?
function settle(s: State, now: number) {
  const skipped = s.correct < 0;
  const right = skipped ? [] : guessersOf(s).filter((id) => s.guesses[id] === s.correct);
  for (const id of right) s.scores[id] = (s.scores[id] ?? 0) + 1;
  s.uncovered[s.qi] = right.length > 0;
  s.reveal = {
    q: s.qi,
    question: s.questions[s.qi],
    skipped,
    choices: s.choices.slice(),
    correct: s.correct,
    authors: s.authors.slice(),
    picks: { ...s.guesses },
    right,
  };
  s.phase = 'reveal';
  s.done = [];
  s.endsAt = now + REVEAL_MS;
  s.rev += 1;
}

export const uncoveredCount = (s: Pick<State, 'uncovered'>) => s.uncovered.filter((u) => u === true).length;

// The end of the game: see CLEAR CONDITIONS at the top.
function finish(s: State, outcome?: Outcome) {
  const perfect = guessersOf(s).filter((id) => (s.scores[id] ?? 0) >= QUESTIONS_PER_GAME);
  let o: Outcome = outcome ?? 'none';
  let winner: string | null = null;
  if (!outcome) {
    if (perfect.length === 1) {
      o = 'player';
      winner = perfect[0];
    } else if (perfect.length === 0 && uncoveredCount(s) >= HOST_WINS_AT) {
      o = 'host';
      winner = s.host;
    }
  }
  s.outcome = o;
  s.winner = winner;
  s.phase = 'over';
  s.endsAt = 0;
  s.done = [];
  s.rev += 1;
}

function afterReveal(s: State, now: number) {
  if (s.qi < QUESTIONS_PER_GAME - 1) {
    s.qi += 1;
    startGuess(s, now);
  } else {
    finish(s);
  }
}

function dropPlayer(state: State, uid: string): State {
  const s = edit(state);
  s.gone.push(uid);
  s.lastLeft = uid;
  s.done = s.done.filter((id) => id !== uid);
  delete s.guesses[uid];
  const present = presentOf(s);
  if (present.length < 2 || (s.host === uid && s.phase !== 'ask')) finish(s, 'none');
  return s;
}

// Call a few times per second on the lobby host. `left` = players who forfeited the game.
export function tick(state: State, now: number, left: string[] = []): State {
  if (state.phase === 'over') return state;
  for (const id of left) if (state.order.includes(id) && !state.gone.includes(id)) return dropPlayer(state, id);

  if (state.phase === 'ask') {
    const allIn = presentOf(state).every((id) => state.done.includes(id)) && now >= state.pickFrom + MIN_ASK_MS;
    if (!allIn && now < state.endsAt) return state;
    const s = edit(state);
    if (s.qi < QUESTIONS_PER_GAME - 1) {
      s.qi += 1;
      startAsk(s, now);
    } else {
      drawHost(s, now);
    }
    return s;
  }
  if (state.phase === 'guess') {
    const allIn = guessersOf(state).every((id) => state.done.includes(id)) && now >= state.pickFrom + MIN_GUESS_MS;
    if (!allIn && now < state.endsAt) return state;
    const s = edit(state);
    settle(s, now);
    return s;
  }
  if (state.endsAt === 0 || now < state.endsAt) return state;
  const s = edit(state);
  if (state.phase === 'draw') startGuess(s, now);
  else afterReveal(s, now);
  return s;
}

export const remainingNow = (state: State, receivedAt: number, now: number) =>
  Math.max(0, state.remainingMs - (now - receivedAt));

// Only the player who won reports "finished" (a draw or a shared victory = nobody).
export const isWinner = (s: Pick<State, 'winner'>, uid: string) => s.winner === uid;
