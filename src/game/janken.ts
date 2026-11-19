// Janken Negotiation rules, with no screen code so they can be tested without a phone.
//
// Every round: pick an INITIAL throw (public) -> 30 s of negotiation -> the last 5 s pick the private
// FINAL throw -> everybody's final throw is revealed at once. Players are paired up each round (an odd
// one out gets a bye). Win = +1, loss = -1, draw = 0; doubled by Double or Nothing agreements.
//
// NEGOTIATION. Long-press a throw to open its menu: PROMISE TO PICK, PROMISE NOT TO PICK, DARE MY
// OPPONENT, DOUBLE OR NOTHING, SACRIFICE (+ END THE MATCH). Each one has follow-up choices, and becomes
// an OFFER (a short code, see offerCode). Your opponent accepts or rejects it. Only an ACCEPTED offer is
// an agreement and only agreements do anything: a bare word is never enforced (betrayal stays possible).
// Everything below is computed from the saved documents, so every phone gets the same answer.
import { makeRng } from './schulte';

export type Throw = 'rock' | 'paper' | 'scissors';
export const THROWS: Throw[] = ['rock', 'paper', 'scissors'];
export const THROW_LABEL: Record<Throw, string> = { rock: 'ROCK', paper: 'PAPER', scissors: 'SCISSORS' };
export const THROW_ICON: Record<Throw, string> = { rock: '✊', paper: '✋', scissors: '✌️' };

// What a player publishes about one round.
//  - `initial` is PUBLIC and can be changed until the final-throw phase.
//  - `throw` is the FINAL throw: '' (hidden) until the reveal, when everyone's is shown at once.
//  - `offers`: codes I propose. `acc` / `rej`: codes my opponent proposed that I accepted / rejected.
export type JankenDoc = {
  uid: string;
  k: number; // round number inside the game, 1-based
  initial: '' | Throw;
  offers: string[];
  acc: string[];
  rej: string[];
  throw: '' | Throw;
};

export const NEGOTIATION_MS = 30000; // initial throw and offers can change
export const EXTRA_NEG_MS = 10000; // the "additional negotiation period" a SACRIFICE can buy
export const INITIAL_MS = 8000; // time to commit the initial throw before negotiation
export const FINAL_MS = 5000; // last seconds: pick the private FINAL throw (initial throw is locked)
export const REVEAL_MS = 4000; // reveal stays on screen this long
export const WAIT_REVEAL_MS = 6000; // how long to wait for a missing reveal before calling it a no-show
export const MAX_ROUNDS = 10; // safety cap so a table that never agrees cannot play forever
export const MAX_OFFERS = 6; // offers one player can have open in a round
export const SCORE_OFFSET = 500; // result score is saved as 500 + net points (it cannot be negative)

export const beats = (a: Throw, b: Throw) =>
  (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper');

// Forced Rotation: the same throw cannot be used in two rounds in a row.
export const allowedThrows = (prev: Throw | null): Throw[] => THROWS.filter((t) => t !== prev);

// ------------------------------------------------------------------ offers
export type OfferKind = 'pick' | 'avoid' | 'dare' | 'dbl' | 'sac' | 'end';
export const KIND_ORDER: OfferKind[] = ['pick', 'avoid', 'dare', 'dbl', 'sac'];
export const END_CODE = 'end||x';

export type ParsedOffer = { kind: OfferKind; t: Throw | null; opt: string; code: string };

// "<kind>|<throw>|<option>", for example "pick|rock|1". Dare options are "y" (dare to pick) or "n"
// (dare NOT to pick), plus "r" (reward) and/or "p" (penalty): "yrp".
export const offerCode = (kind: OfferKind, t: Throw | null, opt: string) => `${kind}|${t ?? ''}|${opt}`;

export function parseOffer(code: string): ParsedOffer | null {
  const [kind, t, opt] = code.split('|');
  if (!['pick', 'avoid', 'dare', 'dbl', 'sac', 'end'].includes(kind)) return null;
  if (kind === 'end') return { kind: 'end', t: null, opt: 'x', code };
  if (!THROWS.includes(t as Throw)) return null;
  return { kind: kind as OfferKind, t: t as Throw, opt: opt ?? '', code };
}

export const kindTitle = (kind: OfferKind, t: Throw | null): string => {
  const T = t ? THROW_LABEL[t] : '';
  switch (kind) {
    case 'pick':
      return `PROMISE TO PICK ${T}`;
    case 'avoid':
      return `PROMISE NOT TO PICK ${T}`;
    case 'dare':
      return 'DARE MY OPPONENT';
    case 'dbl':
      return 'DOUBLE OR NOTHING';
    case 'sac':
      return 'SACRIFICE';
    default:
      return 'END THE MATCH';
  }
};

export const kindBlurb = (kind: OfferKind, t: Throw | null): string => {
  const T = t ? THROW_LABEL[t] : '';
  switch (kind) {
    case 'pick':
      return `Commit to choosing ${T} as your final throw, subject to the selected agreement.`;
    case 'avoid':
      return `Promise to avoid ${T} in your final throw.`;
    case 'dare':
      return 'Challenge your opponent to make a specific decision.';
    case 'dbl':
      return `Put additional stakes on your ${T} selection.`;
    case 'sac':
      return 'Offer a disadvantage in exchange for a strategic advantage.';
    default:
      return 'Both players agree to stop after this round.';
  }
};

export const optionList = (kind: OfferKind, t: Throw | null): { id: string; text: string }[] => {
  const T = t ? THROW_LABEL[t] : '';
  switch (kind) {
    case 'pick':
      return [
        { id: '0', text: `If I pick ${T}, I cannot pick ${T} in the next round only.` },
        { id: '1', text: `If I pick ${T}, my opponent receives a bonus point.` },
        { id: '2', text: `If I pick ${T}, I surrender my right to use Double or Nothing in the next round.` },
        { id: '3', text: `If I pick ${T}, I agree to terminate the match after this round.` },
      ];
    case 'avoid':
      return [
        { id: '0', text: `If I do not pick ${T}, I cannot pick ${T} for the next two rounds.` },
        { id: '1', text: `If I do not pick ${T}, I receive a bonus point.` },
        { id: '2', text: `If I do not pick ${T}, my opponent receives a bonus point.` },
        { id: '3', text: `If I do not pick ${T}, I agree to extend the match for another round.` },
      ];
    case 'dbl':
      return [
        { id: '0', text: `If I win using ${T}, my reward is doubled.` },
        { id: '1', text: `If I lose using ${T}, my penalty is doubled.` },
        { id: '2', text: `If I pick ${T}, my opponent must accept double stakes or terminate the match after this round.` },
      ];
    case 'sac':
      return [
        { id: '0', text: `I will not use ${T} this round in exchange for an additional negotiation period next round.` },
        { id: '1', text: 'I will surrender one point in exchange for removing my Forced Rotation restriction.' },
        { id: '2', text: `I will give my opponent a bonus point if I use ${T}.` },
      ];
    default:
      return [];
  }
};

export const dareText = (t: Throw, opt: string): string => {
  const T = THROW_LABEL[t];
  let s = opt[0] === 'n' ? `I dare my opponent NOT to pick ${T}.` : `I dare my opponent to pick ${T}.`;
  if (opt.includes('r')) s += ' If my opponent accepts and fulfills the dare, they receive a bonus point.';
  if (opt.includes('p')) s += ' If my opponent accepts but breaks the dare, they lose a point.';
  return s;
};

// One sentence for an offer, for the notes and the dialogs.
export function offerText(code: string): string {
  const o = parseOffer(code);
  if (!o) return '';
  if (o.kind === 'end') return 'END THE MATCH: stop after this round.';
  const detail = o.kind === 'dare' ? dareText(o.t!, o.opt) : optionList(o.kind, o.t).find((x) => x.id === o.opt)?.text ?? '';
  return `${kindTitle(o.kind, o.t)}: ${detail}`;
}

// ------------------------------------------------------------------ agreements
export type Agreement = { by: string; to: string; o: ParsedOffer };

// The agreements between two players this round: offers that the other player accepted. Rejecting
// "DOUBLE OR NOTHING: ... must accept double stakes or terminate" ends the match, as it says.
export function agreementsOf(da: JankenDoc | undefined, db: JankenDoc | undefined): Agreement[] {
  const out: Agreement[] = [];
  if (!da || !db) return out;
  const scan = (x: JankenDoc, y: JankenDoc) => {
    for (const code of x.offers) {
      const o = parseOffer(code);
      if (!o || o.kind === 'end') continue;
      if (y.acc.includes(code)) out.push({ by: x.uid, to: y.uid, o });
      else if (o.kind === 'dbl' && o.opt === '2' && y.rej.includes(code)) {
        out.push({ by: x.uid, to: y.uid, o: parseOffer(END_CODE)! }); // refused double stakes: terminate
      }
    }
  };
  scan(da, db);
  scan(db, da);
  // END THE MATCH: both offered it, or one offered and the other accepted.
  const endA = da.offers.includes(END_CODE);
  const endB = db.offers.includes(END_CODE);
  if ((endA && (endB || db.acc.includes(END_CODE))) || (endB && da.acc.includes(END_CODE))) {
    out.push({ by: da.uid, to: db.uid, o: parseOffer(END_CODE)! });
  }
  return out;
}

export type OfferStatus = 'pending' | 'agreed' | 'rejected';
// Status of an offer `code` made by `proposer` (doc) towards `other` (doc).
export function statusOf(code: string, proposer: JankenDoc | undefined, other: JankenDoc | undefined): OfferStatus {
  if (!other || !proposer) return 'pending';
  if (code === END_CODE) {
    if (other.offers.includes(END_CODE) || other.acc.includes(END_CODE)) return 'agreed';
    return other.rej.includes(END_CODE) ? 'rejected' : 'pending';
  }
  if (other.acc.includes(code)) return 'agreed';
  if (other.rej.includes(code)) {
    const o = parseOffer(code);
    return o?.kind === 'dbl' && o.opt === '2' ? 'agreed' : 'rejected'; // refusing it means terminating
  }
  return 'pending';
}

// ------------------------------------------------------------------ what agreements do to you
export type Bans = { t: Throw; from: number; to: number };
export type Carry = {
  bans: Record<string, Bans[]>; // throws a player cannot use in later rounds
  noDouble: Record<string, number[]>; // rounds in which a player gave up Double or Nothing
  extra: Record<string, number[]>; // rounds that start with an additional negotiation period
};
export const emptyCarry = (): Carry => ({ bans: {}, noDouble: {}, extra: {} });
const pushTo = <T,>(rec: Record<string, T[]>, uid: string, v: T) => {
  (rec[uid] ??= []).push(v);
};

export type Constraints = {
  forced: Throw | null; // a PROMISE TO PICK was accepted: this is your final throw
  banned: Throw[]; // throws you cannot use this round
  noRotation: boolean; // a SACRIFICE removed your Forced Rotation restriction
  noDouble: boolean; // you gave up Double or Nothing for this round
};

export function constraintsFor(uid: string, ags: Agreement[], carry: Carry, k: number): Constraints {
  const c: Constraints = { forced: null, banned: [], noRotation: false, noDouble: !!carry.noDouble[uid]?.includes(k) };
  for (const a of ags) {
    if (a.by !== uid) continue;
    if (a.o.kind === 'pick') c.forced = a.o.t;
    else if (a.o.kind === 'avoid' && a.o.t) c.banned.push(a.o.t);
    else if (a.o.kind === 'sac' && a.o.opt === '0' && a.o.t) c.banned.push(a.o.t);
    else if (a.o.kind === 'sac' && a.o.opt === '1') c.noRotation = true;
  }
  for (const b of carry.bans[uid] ?? []) if (k >= b.from && k <= b.to) c.banned.push(b.t);
  return c;
}

// What the INITIAL throw may be (only Forced Rotation limits it).
export const initialAllowed = (prev: Throw | null, c: Constraints): Throw[] => (c.noRotation ? [...THROWS] : allowedThrows(prev));

// What the FINAL throw may be: Forced Rotation, bans, and a forced pick all apply.
export function finalAllowed(prev: Throw | null, c: Constraints): Throw[] {
  const base = initialAllowed(prev, c);
  if (c.forced) return [c.forced];
  const rest = base.filter((t) => !c.banned.includes(t));
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
export type Bonus = { uid: string; delta: number; why: string };
export type RoundLine = {
  k: number;
  a: string;
  b: string;
  ta: Throw;
  tb: Throw;
  stake: 1 | 2;
  winner: string | null;
  bonus: Bonus[];
};
export type Replay = {
  score: Record<string, number>;
  left: string[]; // players who agreed to end the match
  prev: Record<string, Throw | null>; // each player's last throw (for Forced Rotation)
  lines: RoundLine[];
  carry: Carry; // what earlier agreements still do in the NEXT round
  rounds: { pairs: [string, string][]; bye: string | null }[];
};

const docOf = (docs: JankenDoc[], uid: string, k: number) => docs.find((d) => d.uid === uid && d.k === k);

// Replays rounds 1..upTo from the saved docs. Every phone gets the same result from the same docs.
export function replay(seed: string, players: string[], out: string[], docs: JankenDoc[], upTo: number): Replay {
  const score: Record<string, number> = {};
  const prev: Record<string, Throw | null> = {};
  players.forEach((p) => {
    score[p] = 0;
    prev[p] = null;
  });
  const left = new Set<string>();
  const lines: RoundLine[] = [];
  const rounds: Replay['rounds'] = [];
  const carry = emptyCarry();
  for (let k = 1; k <= upTo; k++) {
    const active = players.filter((p) => !out.includes(p) && !left.has(p));
    const prevPairs = k > 1 ? rounds[k - 2]?.pairs ?? [] : [];
    const { pairs, bye } = pairings(seed, k, active, prevPairs);
    rounds.push({ pairs, bye });
    const leaving: string[] = [];
    for (const [a, b] of pairs) {
      const da = docOf(docs, a, k);
      const db = docOf(docs, b, k);
      if (!da?.throw || !db?.throw) continue;
      const throwOf: Record<string, Throw> = { [a]: da.throw, [b]: db.throw };
      const winner = beats(da.throw, db.throw) ? a : beats(db.throw, da.throw) ? b : null;
      // A player who gave up Double or Nothing for this round cannot use it.
      const ags = agreementsOf(da, db).filter((g) => !(g.o.kind === 'dbl' && carry.noDouble[g.by]?.includes(k)));
      let stake: 1 | 2 = 1;
      const bonus: Bonus[] = [];
      const give = (uid: string, delta: number, why: string) => bonus.push({ uid, delta, why });
      let leave = false;
      let extend = false;
      for (const g of ags) {
        const P = g.by;
        const Q = g.to;
        const tP = throwOf[P];
        const tQ = throwOf[Q];
        const t = g.o.t;
        switch (g.o.kind) {
          case 'pick':
            if (tP !== t) break; // (the screen forces it, so this only guards a broken client)
            if (g.o.opt === '0' && t) pushTo(carry.bans, P, { t, from: k + 1, to: k + 1 });
            if (g.o.opt === '1') give(Q, 1, 'promise to pick kept');
            if (g.o.opt === '2') pushTo(carry.noDouble, P, k + 1);
            if (g.o.opt === '3') leave = true;
            break;
          case 'avoid':
            if (tP === t) break;
            if (g.o.opt === '0' && t) pushTo(carry.bans, P, { t, from: k + 1, to: k + 2 });
            if (g.o.opt === '1') give(P, 1, 'promise not to pick kept');
            if (g.o.opt === '2') give(Q, 1, 'promise not to pick kept');
            if (g.o.opt === '3') extend = true;
            break;
          case 'dare': {
            if (!t) break;
            const fulfilled = g.o.opt[0] === 'n' ? tQ !== t : tQ === t;
            if (g.o.opt.includes('r') && fulfilled) give(Q, 1, 'dare fulfilled');
            if (g.o.opt.includes('p') && !fulfilled) give(Q, -1, 'dare broken');
            break;
          }
          case 'dbl':
            if (tP !== t) break;
            if ((g.o.opt === '0' && winner === P) || (g.o.opt === '1' && winner === Q) || g.o.opt === '2') stake = 2;
            break;
          case 'sac':
            if (g.o.opt === '0' && tP !== t) pushTo(carry.extra, P, k + 1);
            if (g.o.opt === '1') give(P, -1, 'sacrifice');
            if (g.o.opt === '2' && tP === t) give(Q, 1, 'sacrifice');
            break;
          case 'end':
            leave = true;
            break;
        }
      }
      if (winner) {
        score[winner] += stake;
        score[winner === a ? b : a] -= stake;
      }
      for (const x of bonus) score[x.uid] += x.delta;
      lines.push({ k, a, b, ta: da.throw, tb: db.throw, stake, winner, bonus });
      prev[a] = da.throw;
      prev[b] = db.throw;
      if (leave && !extend) leaving.push(a, b);
    }
    leaving.forEach((p) => left.add(p));
  }
  return { score, left: [...left], prev, lines, carry, rounds };
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