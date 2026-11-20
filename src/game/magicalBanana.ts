// Magical Banana: pure rules of the word chain, no React, no Firebase.
//
// Players sit in a circle and say a word related to the previous word. Anybody can press JUDGE
// to have the latest word judged by a vote (OK / NO); disqualified players can still vote.
// Last player in wins.
//
// The game is a small state machine. The HOST's phone is the only one that runs it: players
// send "moves" (a word, a judge request, a vote) and the host applies them with `apply`, and
// calls `tick` a few times per second for the timers. Every phone shows the state the host saves.
// A move carries the `rev` of the state it was made for, and `rev` only goes up, so an old or
// repeated move is ignored (replaying all the moves after a restart is safe).
import { makeRng } from './schulte';
import { START_WORDS } from '../data/magicalBananaWords';

// All tuning constants. The rules text says both "5-second rhythm" and "7-second time limit":
// the time limit that disqualifies is TURN_MS.
export const TURN_MS = 7000;
export const VOTE_MS = 12000; // after this, the votes that are in decide (no votes at all = OK)
export const COUNTDOWN_MS = 3000; // the 3-2-1 at the start and after every judging
export const MAX_DRAWS = 2; // the 2nd DRAW disqualifies the player
export const MAX_WORD_LENGTH = 30;

export type Phase = 'countdown' | 'turn' | 'judging' | 'over';
export type Vote = 'ok' | 'no';
export type Entry = { by: string | null; word: string; judged: boolean }; // by null = the starting word
export type Judge = {
  by: string; // who pressed JUDGE
  author: string; // whose word is judged
  word: string;
  prev: string; // the word it should be related to
  voters: string[]; // everybody who has not left (disqualified players included), except the author
  votes: Record<string, Vote>;
};
// What happened last, for the message on the screen.
export type Note = {
  kind: 'ok' | 'draw' | 'no' | 'strike2' | 'timeout' | 'forfeit';
  uid: string;
  word?: string;
  ok?: number;
  no?: number;
  strikes?: number;
};

export type State = {
  ver: number; // goes up on every change (the host saves when it changes)
  rev: number; // goes up on every step of the game (moves are made for one rev)
  order: string[]; // the circle
  alive: string[];
  gone: string[]; // players who forfeited the game: they no longer vote (disqualified players still do)
  strikes: Record<string, number>; // DRAWs received
  words: Record<string, string>; // what each player's box shows
  history: Entry[]; // the valid words so far; the last one is the word to answer
  current: string; // whose turn it is
  phase: Phase;
  opening: boolean; // the countdown is the opening one (no word shown yet)
  judge: Judge | null;
  last: Note | null;
  winner: string | null;
  endsAt: number; // when the running timer ends, in the HOST's clock (0 = none)
  remainingMs: number; // filled in when the state is saved, so every phone can count down
};

export type Move = { uid: string; rev: number; kind: 'word' | 'judge' | 'vote'; word?: string; vote?: Vote };

// ---------------------------------------------------------------- setup ----
export function shuffleOrder(playerIds: string[], seed: string): string[] {
  const rnd = makeRng(`${seed}:order`);
  const a = playerIds.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pickStartWord = (seed: string): string =>
  START_WORDS[Math.floor(makeRng(`${seed}:start`)() * START_WORDS.length)];

export function newGame(order: string[], startWord: string, now: number): State {
  return {
    ver: 1,
    rev: 1,
    order: order.slice(),
    alive: order.slice(),
    gone: [],
    strikes: {},
    words: Object.fromEntries(order.map((id) => [id, ''])),
    history: [{ by: null, word: startWord, judged: true }],
    current: order[0],
    phase: 'countdown',
    opening: true,
    judge: null,
    last: null,
    winner: null,
    endsAt: now + COUNTDOWN_MS,
    remainingMs: COUNTDOWN_MS,
  };
}

// --------------------------------------------------------------- helpers ----
export const lastEntry = (s: State): Entry => s.history[s.history.length - 1];

export function nextAlive(order: string[], alive: string[], from: string): string | null {
  const i = order.indexOf(from);
  if (i < 0) return alive[0] ?? null;
  for (let k = 1; k <= order.length; k++) {
    const id = order[(i + k) % order.length];
    if (alive.includes(id)) return id;
  }
  return null;
}

export function cleanWord(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const w = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_WORD_LENGTH).trim();
  return /[A-Za-z0-9À-￿]/.test(w) ? w : '';
}

// A copy that is marked as changed.
function edit(s: State): State {
  const c: State = JSON.parse(JSON.stringify(s));
  c.ver = s.ver + 1;
  return c;
}

function giveTurn(s: State, uid: string, now: number) {
  s.current = uid;
  s.words[uid] = ''; // the box is erased when it is their turn again
  s.phase = 'turn';
  s.endsAt = now + TURN_MS;
  s.rev += 1;
}

function countdown(s: State, now: number) {
  s.phase = 'countdown';
  s.opening = false;
  s.endsAt = now + COUNTDOWN_MS;
  s.rev += 1;
}

function endGame(s: State) {
  s.phase = 'over';
  s.winner = s.alive.length === 1 ? s.alive[0] : null;
  s.judge = null;
  s.endsAt = 0;
  s.rev += 1;
}

// ----------------------------------------------------------------- moves ----
export function apply(state: State, move: Move, now: number): State {
  if (move.rev !== state.rev) return state; // made for an older step of the game
  // Only players still in can say a word or press JUDGE; disqualified players can still VOTE.
  if (move.kind !== 'vote' && !state.alive.includes(move.uid)) return state;

  if (move.kind === 'word') {
    if (state.phase !== 'turn' || move.uid !== state.current) return state;
    const word = cleanWord(move.word);
    const next = nextAlive(state.order, state.alive, move.uid);
    if (!word || !next) return state;
    const s = edit(state);
    s.history.push({ by: move.uid, word, judged: false });
    s.words[move.uid] = word;
    s.last = null;
    giveTurn(s, next, now);
    return s;
  }

  if (move.kind === 'judge') {
    if (state.phase !== 'turn') return state;
    const top = lastEntry(state);
    if (!top.by || top.judged) return state; // nothing to judge, or already judged
    // Everybody who has not left, except the author: disqualified players vote too.
    const voters = state.order.filter((id) => id !== top.by && !(state.gone ?? []).includes(id));
    if (voters.length === 0) return state;
    const s = edit(state);
    s.phase = 'judging';
    s.judge = {
      by: move.uid,
      author: top.by,
      word: top.word,
      prev: state.history[state.history.length - 2]?.word ?? '',
      voters,
      votes: {},
    };
    s.last = null;
    s.endsAt = now + VOTE_MS;
    s.rev += 1;
    return s;
  }

  // vote
  const j = state.judge;
  if (state.phase !== 'judging' || !j || !j.voters.includes(move.uid) || move.uid in j.votes) return state;
  if (move.vote !== 'ok' && move.vote !== 'no') return state;
  const s = edit(state);
  s.judge!.votes[move.uid] = move.vote;
  if (s.judge!.voters.every((id) => id in s.judge!.votes)) resolveJudging(s, now);
  return s;
}

// Counts the votes and carries out the result. Works on a copy that is already being edited.
function resolveJudging(s: State, now: number) {
  const j = s.judge!;
  const votes = Object.values(j.votes);
  const ok = votes.filter((v) => v === 'ok').length;
  const no = votes.length - ok;
  // More OK than NO passes; no votes at all passes; more NO fails; a tie is a DRAW.
  const result: 'ok' | 'draw' | 'no' = ok > no ? 'ok' : no > ok ? 'no' : ok === 0 ? 'ok' : 'draw';
  s.judge = null;

  if (result === 'ok') {
    lastEntry(s).judged = true;
    s.last = { kind: 'ok', uid: j.author, word: j.word, ok, no };
    countdown(s, now);
    return;
  }

  // The word is thrown out either way: the chain goes back to the word before it.
  s.history.pop();
  s.words[j.author] = '';
  let disqualified = result === 'no';
  if (result === 'draw') {
    s.strikes[j.author] = (s.strikes[j.author] ?? 0) + 1;
    disqualified = s.strikes[j.author] >= MAX_DRAWS;
  }
  if (disqualified) {
    s.alive = s.alive.filter((id) => id !== j.author);
    s.last = { kind: result === 'no' ? 'no' : 'strike2', uid: j.author, word: j.word, ok, no };
  } else {
    // DRAW (first one): the author stays and has to say another word.
    s.last = { kind: 'draw', uid: j.author, word: j.word, ok, no, strikes: s.strikes[j.author] };
    s.current = j.author;
    s.words[j.author] = '';
  }
  if (s.alive.length <= 1) endGame(s);
  else countdown(s, now);
}

// ----------------------------------------------------------------- timers ----
function dropPlayer(state: State, uid: string, now: number, kind: 'timeout' | 'forfeit'): State {
  const s = edit(state);
  const wasCurrent = s.current === uid;
  s.alive = s.alive.filter((id) => id !== uid);
  if (kind === 'forfeit') s.gone = [...(s.gone ?? []), uid];
  s.last = { kind, uid };
  if (s.alive.length <= 1) {
    endGame(s);
    return s;
  }
  if (s.phase === 'judging' && s.judge) {
    s.judge.voters = s.judge.voters.filter((id) => id !== uid);
    delete s.judge.votes[uid];
    if (wasCurrent) s.current = nextAlive(s.order, s.alive, uid)!;
    if (s.judge.voters.every((id) => id in s.judge!.votes)) resolveJudging(s, now);
    return s;
  }
  if (wasCurrent) {
    const next = nextAlive(s.order, s.alive, uid)!;
    if (s.phase === 'turn') giveTurn(s, next, now);
    else {
      s.current = next; // during a countdown: the next player will be the one to start
      s.words[next] = '';
    }
  }
  return s;
}

// A disqualified player forfeits the game: they stop being a voter.
function playerLeft(state: State, uid: string, now: number): State {
  const s = edit(state);
  s.gone = [...(s.gone ?? []), uid];
  if (s.phase === 'judging' && s.judge) {
    s.judge.voters = s.judge.voters.filter((id) => id !== uid);
    delete s.judge.votes[uid];
    if (s.judge.voters.every((id) => id in s.judge!.votes)) resolveJudging(s, now);
  }
  return s;
}

// Call a few times per second on the host. `left` = players who forfeited the game.
export function tick(state: State, now: number, left: string[] = []): State {
  if (state.phase === 'over') return state;
  for (const id of left) {
    if ((state.gone ?? []).includes(id)) continue;
    if (state.alive.includes(id)) return dropPlayer(state, id, now, 'forfeit');
    return playerLeft(state, id, now); // already disqualified, and now leaves: stop waiting for their vote
  }
  if (state.endsAt === 0 || now < state.endsAt) return state;

  if (state.phase === 'countdown') {
    const s = edit(state);
    giveTurn(s, s.current, now);
    return s;
  }
  if (state.phase === 'turn') return dropPlayer(state, state.current, now, 'timeout');
  // judging: the votes that are in decide
  const s = edit(state);
  resolveJudging(s, now);
  return s;
}

export const remainingNow = (state: State, receivedAt: number, now: number) =>
  Math.max(0, state.remainingMs - (now - receivedAt));
