// Piano Tiles: pure rules, no React, no Firebase.
//
// A piano plays a CHAIN of notes and every player has to play EXACTLY the same notes, in the same
// order, on a board of 8 tiles (2 rows x 4 columns) that sound Do Re Mi Fa Sol La Ti DO. Anyone who
// plays a wrong note, runs out of notes or runs out of time is out. The chain starts with 4 notes
// (Do Re Mi Fa); every round the SAME notes repeat from the start and ONE NEW NOTE is added at the end
// (Do Re Mi Fa Sol, then Do Re Mi Fa Sol La ...), and the beat gets harder. It goes on, practically for
// ever, until one player is left: the last survivor wins.
//
// A ROUND has three phases:
//   listen   the piano plays the melody (every phone plays it itself, from the seed: the melody is not
//            in the saved state)
//   play     everybody plays the melody back; a player hands in what they played (all of it, or as soon
//            as they hit a wrong note, or whatever they have when the time is up)
//   reveal   who passed and who is out
//
// THE CHAIN of round r is the first lengthFor(r) notes of one chain made from the seed, so it grows
// by one note each round and the notes you already know come back first. The chain opens with the
// scale itself (SCALE_OPENING: Do Re Mi Fa Sol La Ti DO, as in the rules); after the 8th note the
// new notes are picked at random. The BEAT is new every round:
// the gaps between the notes are not fixed, and they get shorter and more uneven until HARD_ROUND,
// where they are at their hardest (quick pairs, held notes, no steady pulse). Later rounds stay that
// hard and only get longer.
//
// DETAILS (decisions, change them here):
//  - Only the notes count, not the rhythm you play them in (but the time you take is kept: it
//    decides the winner if several players survive to the end).
//  - If NOBODY passes a round, nobody is out and the round is played again: the same chain, with a
//    new beat (up to MAX_REDOS times in a game); after that everybody is out and the game is a draw.
//  - ROUND_CAP is only a safety net (the game is meant to go on until one player is left). If it is
//    ever reached, the players still in clear the game and the one with the least total time wins
//    (an exact tie is a draw).
//
// Like Fortune and Xibalba, the HOST's phone is the only one that runs the game: players send one
// "move" per round (what they played) and the host applies it with `apply`, calls `tick` a few times
// per second for the timers and saves the state, which every phone shows. What the players played
// stays on the host (`picks` is stripped by `publicState`) until the reveal. A move carries the `rev`
// of the round it was made for, and `rev` only goes up, so an old move is ignored.
import { makeRng } from './schulte';

// ----------------------------------------------------------- tuning ----
export const TILES = 8;
export const NOTE_NAMES = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti', 'DO'];
export const START_LENGTH = 4; // notes in round 1 (Do Re Mi Fa)
export const SCALE_OPENING = true; // the chain opens with Do Re Mi Fa Sol La Ti DO; false = all random
export const HARD_ROUND = 8; // from this round on the beat is at its hardest
export const ROUND_CAP = 100; // a safety net, the game is meant to go on until one player is left
export const MAX_REDOS = 2;
export const LISTEN_LEAD_MS = 1500; // the quiet before the piano starts
export const LISTEN_TAIL_MS = 1000; // the quiet after the last note
export const NOTE_RING_MS = 700; // how long the last note is allowed to ring
export const REVEAL_MS = 4500;
export const MIN_PLAY_MS = 800; // even if everybody handed in at once, the play phase lasts this long

export const lengthFor = (round: number) => START_LENGTH + round - 1;
// 0 (round 1) .. 1 (HARD_ROUND and later)
export const difficultyFor = (round: number) => Math.max(0, Math.min(1, (round - 1) / (HARD_ROUND - 1)));
// Time to play the melody back: the harder the round, the longer the melody, the more time it gets.
export const playMsFor = (round: number) => 5000 + lengthFor(round) * 1500;

export type Plan = {
  notes: number[]; // tile numbers 0..7, in the order the piano plays them
  onsets: number[]; // when each note starts, in ms after the first note
  listenMs: number; // how long the listen phase lasts
  playMs: number; // how long the play phase lasts
  expected: string; // the notes as digits, "0472..."
};

// The melody and the beat of a round. The same seed, round and redo always give the same plan, so
// every phone can play it without being sent it.
const planCache = new Map<string, Plan>();
export function planFor(seed: string, round: number, redo: number): Plan {
  const key = `${seed}|${round}|${redo}`;
  const hit = planCache.get(key);
  if (hit) return hit;
  const plan = buildPlan(seed, round, redo);
  if (planCache.size > 60) planCache.clear();
  planCache.set(key, plan);
  return plan;
}

function buildPlan(seed: string, round: number, redo: number): Plan {
  const len = lengthFor(round);
  // one chain per seed: it only gets longer, so earlier notes come back first. A replayed round
  // (redo) keeps the SAME chain and only gets a new beat.
  const mrnd = makeRng(`${seed}:piano:melody`);
  const master: number[] = [];
  const max = lengthFor(ROUND_CAP);
  while (master.length < max) {
    const k = master.length;
    if (SCALE_OPENING && k < TILES) {
      master.push(k);
      continue;
    }
    let n = Math.floor(mrnd() * TILES);
    if (k >= 2 && master[k - 1] === n && master[k - 2] === n) n = (n + 1 + Math.floor(mrnd() * (TILES - 1))) % TILES;
    master.push(n);
  }
  const notes = master.slice(0, len);

  const d = difficultyFor(round);
  const base = 760 - 540 * d; // 760 ms between notes at the start, 220 ms at the hardest
  const spread = 0.2 + 0.65 * d; // how uneven the beat is
  const rrnd = makeRng(`${seed}:piano:beat:${round}:${redo}`);
  const onsets = [0];
  for (let i = 1; i < len; i++) {
    let gap = base * (1 + (rrnd() * 2 - 1) * spread);
    const roll = rrnd();
    if (d > 0.3 && roll < 0.3 * d) gap = base * 0.5; // a quick pair
    else if (d > 0.5 && roll > 1 - 0.2 * d) gap = base * 1.8; // a held note
    onsets.push(onsets[i - 1] + Math.max(120, Math.round(gap)));
  }
  return {
    notes,
    onsets,
    listenMs: LISTEN_LEAD_MS + onsets[len - 1] + NOTE_RING_MS + LISTEN_TAIL_MS,
    playMs: playMsFor(round),
    expected: notes.join(''),
  };
}

export const isValidPlay = (seq: unknown, max: number): seq is string =>
  typeof seq === 'string' && seq.length <= max && /^[0-7]*$/.test(seq);

// ------------------------------------------------------------ state ----
export type Phase = 'listen' | 'play' | 'reveal' | 'over';
export type FailReason = 'wrong' | 'short' | 'none'; // a wrong note / stopped early / handed in nothing

export type Reveal = {
  round: number;
  length: number;
  passed: string[];
  failed: { uid: string; reason: FailReason }[];
  redo: boolean; // nobody passed: the round is played again
  allOut: boolean; // nobody passed and no redo is left: everybody is out
};

export type State = {
  ver: number; // goes up on every change (the host saves when it changes)
  rev: number; // goes up on every phase (moves are made for one rev)
  seed: string;
  order: string[]; // everybody, fixed order for the screen
  alive: string[]; // still in the game (after the end: only those who cleared it)
  round: number; // 1..ROUND_CAP
  redo: number; // how many times a round was replayed because nobody passed
  phase: Phase;
  done: string[]; // players who have handed in this round (not WHAT they played)
  rounds: Record<string, number>; // rounds each player has passed
  times: Record<string, number>; // total ms each player took to play the rounds they passed
  reveal: Reveal | null;
  lastLeft: string | null; // the last player who left (forfeited)
  winners: string[]; // who cleared the game
  endsAt: number; // when the running timer ends, in the HOST's clock (0 = none)
  phaseFrom: number; // when this phase started, in the HOST's clock
  remainingMs: number; // filled in when the state is saved, so every phone can count down
  // HOST ONLY (empty in a saved state, see publicState).
  picks: Record<string, string>;
  pickMs: Record<string, number>;
};

export type Move = { uid: string; rev: number; seq: string; ms: number; at: number };

export const publicState = (s: State): State => ({ ...s, picks: {}, pickMs: {} });

export function shuffleOrder(playerIds: string[], seed: string): string[] {
  const a = playerIds.slice();
  const rnd = makeRng(`${seed}:piano:order`);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function edit(s: State): State {
  const c: State = JSON.parse(JSON.stringify(s));
  c.ver = s.ver + 1;
  return c;
}

function startListen(s: State, now: number) {
  s.phase = 'listen';
  s.picks = {};
  s.pickMs = {};
  s.done = [];
  s.reveal = null;
  s.phaseFrom = now;
  s.endsAt = now + planFor(s.seed, s.round, s.redo).listenMs;
  s.rev += 1;
}

export function newGame(order: string[], seed: string, now: number): State {
  const s: State = {
    ver: 1,
    rev: 0,
    seed,
    order: order.slice(),
    alive: order.slice(),
    round: 1,
    redo: 0,
    phase: 'listen',
    done: [],
    rounds: Object.fromEntries(order.map((id) => [id, 0])),
    times: Object.fromEntries(order.map((id) => [id, 0])),
    reveal: null,
    lastLeft: null,
    winners: [],
    endsAt: 0,
    phaseFrom: now,
    remainingMs: 0,
    picks: {},
    pickMs: {},
  };
  startListen(s, now);
  s.remainingMs = s.endsAt - now;
  return s;
}

function endGame(s: State) {
  s.phase = 'over';
  s.winners = s.alive.slice(); // who is still in cleared the game
  s.endsAt = 0;
  s.done = [];
  s.rev += 1;
}

// ------------------------------------------------------------ moves ----
// A player hands in what they played this round (once). `ms` is how long they took, from the start
// of the play phase.
export function apply(state: State, move: Move): State {
  if (state.phase !== 'play' || move.rev !== state.rev) return state;
  if (!state.alive.includes(move.uid) || state.done.includes(move.uid)) return state;
  const plan = planFor(state.seed, state.round, state.redo);
  if (!isValidPlay(move.seq, plan.notes.length)) return state;
  const s = edit(state);
  s.picks[move.uid] = move.seq;
  s.pickMs[move.uid] = Math.max(0, Math.min(600000, Math.round(Number(move.ms) || 0)));
  s.done.push(move.uid);
  return s;
}

// ----------------------------------------------------------- timers ----
function resolve(s: State, now: number) {
  const plan = planFor(s.seed, s.round, s.redo);
  const passed: string[] = [];
  const failed: Reveal['failed'] = [];
  for (const id of s.alive) {
    const seq = s.picks[id];
    if (seq === plan.expected) passed.push(id);
    else if (seq === undefined || seq === '') failed.push({ uid: id, reason: 'none' });
    else if (seq.length < plan.expected.length && plan.expected.startsWith(seq)) failed.push({ uid: id, reason: 'short' });
    else failed.push({ uid: id, reason: 'wrong' });
  }
  const nobody = passed.length === 0;
  const redo = nobody && s.redo < MAX_REDOS;
  const allOut = nobody && !redo;
  for (const id of passed) {
    s.rounds[id] += 1;
    s.times[id] += s.pickMs[id] ?? 0;
  }
  s.reveal = { round: s.round, length: plan.notes.length, passed, failed, redo, allOut };
  if (redo) s.redo += 1;
  if (!nobody) s.alive = passed;
  else if (allOut) s.alive = [];
  s.picks = {};
  s.pickMs = {};
  s.done = [];
  s.phase = 'reveal';
  s.endsAt = now + REVEAL_MS;
  s.rev += 1;
}

function afterReveal(s: State, now: number) {
  const r = s.reveal;
  if (r?.redo) {
    startListen(s, now); // the same round again, with a new melody (redo went up)
    return;
  }
  if (s.alive.length <= 1 || s.round >= ROUND_CAP) {
    endGame(s);
    return;
  }
  s.round += 1;
  startListen(s, now);
}

// A player who forfeited the game is out at once.
function dropPlayer(state: State, uid: string): State {
  const s = edit(state);
  s.alive = s.alive.filter((id) => id !== uid);
  s.done = s.done.filter((id) => id !== uid);
  delete s.picks[uid];
  delete s.pickMs[uid];
  s.lastLeft = uid;
  if (s.alive.length <= 1 && s.phase !== 'reveal') endGame(s);
  return s;
}

// Call a few times per second on the host. `left` = players who forfeited the game.
export function tick(state: State, now: number, left: string[] = []): State {
  if (state.phase === 'over') return state;
  for (const id of left) if (state.alive.includes(id)) return dropPlayer(state, id);
  if (state.phase === 'listen') {
    if (now < state.endsAt) return state;
    const s = edit(state);
    s.phase = 'play';
    s.phaseFrom = now;
    s.endsAt = now + playMsFor(s.round);
    s.rev += 1;
    return s;
  }
  if (state.phase === 'play') {
    const allIn = state.alive.every((id) => state.done.includes(id)) && now >= state.phaseFrom + MIN_PLAY_MS;
    if (!allIn && now < state.endsAt) return state;
    const s = edit(state);
    resolve(s, now);
    return s;
  }
  if (state.endsAt === 0 || now < state.endsAt) return state;
  const s = edit(state);
  afterReveal(s, now);
  return s;
}

export const remainingNow = (state: State, receivedAt: number, now: number) =>
  Math.max(0, state.remainingMs - (now - receivedAt));

// ----------------------------------------------------------- results ----
export type Result = { uid: string; finished: boolean; totalMs: number; forfeited?: boolean; score?: number };

// Only the players who cleared the game report finished: true. One of them = the winner. Several =
// the one with the least total time. An exact tie, or nobody = a draw.
export function pickWinner(results: Result[]): string | null {
  const done = results.filter((r) => r.finished && !r.forfeited);
  if (done.length === 0) return null;
  const best = Math.min(...done.map((r) => r.totalMs));
  const top = done.filter((r) => r.totalMs === best);
  return top.length === 1 ? top[0].uid : null;
}

export const describeResult = (r: Result) =>
  r.finished ? `last one standing after ${r.score ?? 0} rounds` : `out after ${r.score ?? 0} round${(r.score ?? 0) === 1 ? '' : 's'}`;