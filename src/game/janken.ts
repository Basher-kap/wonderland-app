// Janken Negotiation rules, with no screen code so they can be tested without a phone.
//
// Every round: a 3-2-1 countdown -> 60 s of negotiation (the public INITIAL throw is chosen and can change
// during it) -> the last 5 s pick the private FINAL throw -> everybody's final throw is revealed at once.
// Players are paired up each round (an odd one out gets a bye). Win = +1, loss = -1, draw = 0.
// The match always lasts MAX_ROUNDS (10) rounds: round 10 is the last, and the most points wins.
//
// NEGOTIATION (long-press a throw, for example ROCK):
//   "I PROMISE TO PICK ROCK"      follow-ups (any of them):
//       a) "If I really pick it, I am disabled to pick it for the next round only."
//       b) "If I lied, I am disabled to pick PAPER / SCISSORS / BOTH for the next round."
//   "I PROMISE NOT TO PICK ROCK"  follow-ups (any of them):
//       a) "If I really don't pick it, I am disabled to pick ROCK for the next round only."
//       b) "If I lied and picked ROCK anyway, I am disabled to pick PAPER / SCISSORS / BOTH next round."
// The promise itself is NOT enforced (you may lie). But at the reveal the game checks what you really
// threw and applies the matching consequence by itself: the throws you are disabled from are greyed out
// in your next round (both the initial and the final throw). Everything is computed from the saved
// documents, so every phone gets the same answer.
import { makeRng } from './schulte';

export type Throw = 'rock' | 'paper' | 'scissors';
export const THROWS: Throw[] = ['rock', 'paper', 'scissors'];
export const THROW_LABEL: Record<Throw, string> = { rock: 'ROCK', paper: 'PAPER', scissors: 'SCISSORS' };
export const THROW_ICON: Record<Throw, string> = { rock: '✊', paper: '✋', scissors: '✌️' };

// What a player publishes about one round.
//  - `initial` is PUBLIC and can be changed until the final-throw phase.
//  - `throw` is the FINAL throw: '' (hidden) until the reveal, when everyone's is shown at once.
//  - `offers`: my promise (at most one). (`acc` / `rej` are not used any more: they stay in the document so
//    the Firestore rules do not have to change.)
export type JankenDoc = {
  uid: string;
  k: number; // round number inside the game, 1-based
  initial: '' | Throw;
  offers: string[];
  acc: string[];
  rej: string[];
  throw: '' | Throw;
};

export const COUNTDOWN_MS = 3000; // 3-2-1 before every round
export const NEGOTIATION_MS = 60000; // 1 minute: the initial throw and the promise can change
export const FINAL_MS = 5000; // last seconds: pick the private FINAL throw (initial throw is locked)
export const REVEAL_MS = 4000; // reveal stays on screen this long
export const WAIT_REVEAL_MS = 6000; // how long to wait for a missing reveal before calling it a no-show
export const MAX_ROUNDS = 10; // the match always ends after this round
export const SCORE_OFFSET = 500; // result score is saved as 500 + net points (it cannot be negative)

export const beats = (a: Throw, b: Throw) =>
  (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper');

// Forced Rotation: the same throw cannot be used in two rounds in a row.
export const allowedThrows = (prev: Throw | null): Throw[] => THROWS.filter((t) => t !== prev);

// ------------------------------------------------------------------ promises
export type PromiseKind = 'pick' | 'avoid';
export type SetChoice = Throw | 'both'; // which of the OTHER two throws you are disabled from
export type Promise_ = { kind: PromiseKind; t: Throw; a: boolean; b: SetChoice | null; code: string };

export const othersOf = (t: Throw): Throw[] => THROWS.filter((x) => x !== t);

// "<kind>|<throw>|<follow-ups>", e.g. "pick|rock|a+b:both" (follow-up a, and b with BOTH other throws).
export function promiseCode(kind: PromiseKind, t: Throw, a: boolean, b: SetChoice | null): string {
  const parts = [a ? 'a' : '', b ? `b:${b}` : ''].filter(Boolean);
  return `${kind}|${t}|${parts.join('+')}`;
}

export function parsePromise(code: string): Promise_ | null {
  const [kind, t, opt = ''] = code.split('|');
  if ((kind !== 'pick' && kind !== 'avoid') || !THROWS.includes(t as Throw)) return null;
  const parts = opt.split('+').filter(Boolean);
  const a = parts.includes('a');
  const bPart = parts.find((p) => p.startsWith('b:'));
  let b: SetChoice | null = null;
  if (bPart) {
    const v = bPart.slice(2);
    if (v === 'both' || (THROWS.includes(v as Throw) && v !== t)) b = v as SetChoice;
    else return null;
  }
  return { kind, t: t as Throw, a, b, code };
}

// A player's promise this round (at most one), if any.
export const promiseOf = (d: JankenDoc | undefined): Promise_ | null => {
  for (const c of d?.offers ?? []) {
    const p = parsePromise(c);
    if (p) return p;
  }
  return null;
};

export const setLabel = (t: Throw, b: SetChoice): string =>
  b === 'both' ? othersOf(t).map((x) => THROW_LABEL[x]).join(' and ') : THROW_LABEL[b];
const setThrows = (t: Throw, b: SetChoice): Throw[] => (b === 'both' ? othersOf(t) : [b]);

export const promiseTitle = (kind: PromiseKind, t: Throw) =>
  kind === 'pick' ? `I PROMISE TO PICK ${THROW_LABEL[t]}` : `I PROMISE NOT TO PICK ${THROW_LABEL[t]}`;

// The follow-up sentences the player can choose from (b's list is chosen separately).
export const followA = (kind: PromiseKind, t: Throw) =>
  kind === 'pick'
    ? `If I really pick ${THROW_LABEL[t]}, I am disabled to pick it for the next round only.`
    : `If I really don't pick ${THROW_LABEL[t]}, I am disabled to pick ${THROW_LABEL[t]} for the next round only.`;
export const followB = (kind: PromiseKind, t: Throw, b: SetChoice | null) => {
  const what = b ? setLabel(t, b) : 'PAPER / SCISSORS / BOTH (choose)'.replace('PAPER / SCISSORS', othersOf(t).map((x) => THROW_LABEL[x]).join(' / '));
  return kind === 'pick'
    ? `If I lied, I am disabled to pick ${what} for the next round.`
    : `If I lied and picked ${THROW_LABEL[t]} anyway, I am disabled to pick ${what} for the next round.`;
};

// All the lines of a promise, for the notes and the dialogs.
export function promiseLines(code: string): string[] {
  const p = parsePromise(code);
  if (!p) return [];
  const lines = [promiseTitle(p.kind, p.t)];
  if (p.a) lines.push(followA(p.kind, p.t));
  if (p.b) lines.push(followB(p.kind, p.t, p.b));
  return lines;
}

// ------------------------------------------------------------------ what promises do to you
// A throw you are disabled from in a later round (because of a promise you made).
export type Ban = { t: Throw; round: number };
export type Carry = { bans: Record<string, Ban[]> };
export const emptyCarry = (): Carry => ({ bans: {} });

export const bannedFor = (carry: Carry, uid: string, k: number): Throw[] => [
  ...new Set((carry.bans[uid] ?? []).filter((b) => b.round === k).map((b) => b.t)),
];

// What you may throw in round k: Forced Rotation and promise bans. (If the bans would leave nothing,
// they are ignored so you always have a throw.)
export function allowedFor(prev: Throw | null, banned: Throw[]): Throw[] {
  const base = allowedThrows(prev);
  const rest = base.filter((t) => !banned.includes(t));
  return rest.length > 0 ? rest : base;
}

// ------------------------------------------------------------------ pairings
// Who plays whom in round k. Same answer on every phone (seeded), and nobody is paired with the
// same player twice in a row when there is another choice. Returns pairs and the player with a bye.
export function pairings(seed: string, k: number, ids: string[], prevPairs: [string, string][] = []): {
  pairs: [string, string][];
  bye: string | null;
} {
  const sorted = [...ids].sort();
  const rnd = makeRng(`${seed}:pairs:${k}`);
  let best: { pairs: [string, string][]; bye: string | null } | null = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const order = [...sorted];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const pairs: [string, string][] = [];
    for (let i = 0; i + 1 < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
    const bye = order.length % 2 === 1 ? order[order.length - 1] : null;
    best = { pairs, bye };
    const repeat = pairs.some(([a, b]) => prevPairs.some(([c, d]) => (a === c && b === d) || (a === d && b === c)));
    if (!repeat) break;
  }
  return best ?? { pairs: [], bye: null };
}

// ------------------------------------------------------------------ replay
export type Effect = { uid: string; text: string };
export type RoundLine = { k: number; a: string; b: string; ta: Throw; tb: Throw; winner: string | null; effects: Effect[] };
export type Replay = {
  score: Record<string, number>;
  prev: Record<string, Throw | null>; // each player's last throw (for Forced Rotation)
  lines: RoundLine[];
  carry: Carry; // the throws players are disabled from in the NEXT rounds
  rounds: { pairs: [string, string][]; bye: string | null }[];
};

const docOf = (docs: JankenDoc[], uid: string, k: number) => docs.find((d) => d.uid === uid && d.k === k);

// Checks a revealed throw against the player's promise and applies what they agreed to:
// kept it or lied -> the matching throws are disabled in round k+1.
function applyPromise(d: JankenDoc, k: number, carry: Carry, effects: Effect[]) {
  const p = promiseOf(d);
  if (!p || !d.throw) return;
  const kept = p.kind === 'pick' ? d.throw === p.t : d.throw !== p.t;
  const ban = (ts: Throw[]) => ts.forEach((t) => (carry.bans[d.uid] ??= []).push({ t, round: k + 1 }));
  if (p.a && kept) {
    ban([p.t]);
    effects.push({ uid: d.uid, text: `kept the promise: cannot pick ${THROW_LABEL[p.t]} next round` });
  }
  if (p.b && !kept) {
    ban(setThrows(p.t, p.b));
    effects.push({ uid: d.uid, text: `lied: cannot pick ${setLabel(p.t, p.b)} next round` });
  }
}

// Replays rounds 1..upTo from the saved docs. Every phone gets the same result from the same docs.
export function replay(seed: string, players: string[], out: string[], docs: JankenDoc[], upTo: number): Replay {
  const score: Record<string, number> = {};
  const prev: Record<string, Throw | null> = {};
  players.forEach((p) => {
    score[p] = 0;
    prev[p] = null;
  });
  const lines: RoundLine[] = [];
  const rounds: Replay['rounds'] = [];
  const carry = emptyCarry();
  for (let k = 1; k <= upTo; k++) {
    const active = players.filter((p) => !out.includes(p));
    const prevPairs = k > 1 ? rounds[k - 2]?.pairs ?? [] : [];
    const { pairs, bye } = pairings(seed, k, active, prevPairs);
    rounds.push({ pairs, bye });
    for (const [a, b] of pairs) {
      const da = docOf(docs, a, k);
      const db = docOf(docs, b, k);
      if (!da?.throw || !db?.throw) continue;
      const effects: Effect[] = [];
      applyPromise(da, k, carry, effects);
      applyPromise(db, k, carry, effects);
      const winner = beats(da.throw, db.throw) ? a : beats(db.throw, da.throw) ? b : null;
      if (winner) {
        score[winner] += 1;
        score[winner === a ? b : a] -= 1;
      }
      lines.push({ k, a, b, ta: da.throw, tb: db.throw, winner, effects });
      prev[a] = da.throw;
      prev[b] = db.throw;
    }
  }
  return { score, prev, lines, carry, rounds };
}

// ---- Registry hooks
type Row = { uid: string; finished: boolean; totalMs: number; forfeited?: boolean; score?: number };

// Most points wins. A forfeit loses. A tie for the top = nobody wins (a draw).
export function pickWinner(results: Row[]): string | null {
  const live = results.filter((r) => !r.forfeited);
  if (live.length === 0) return null;
  const top = Math.max(...live.map((r) => r.score ?? 0));
  const best = live.filter((r) => (r.score ?? 0) === top);
  return best.length === 1 ? best[0].uid : null;
}

export const netOf = (score: number) => score - SCORE_OFFSET;
export const describeScore = (score: number) => {
  const n = netOf(score);
  return `${n > 0 ? '+' : ''}${n} points`;
};