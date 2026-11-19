// Janken Negotiation rules, with no screen code so they can be tested without a phone.
//
// Every round: pick an INITIAL throw -> 30 s of negotiation (the FINAL throw can change any time) ->
// everybody's final throw is revealed at once. Players are paired up each round (an odd one out gets
// a bye). Win = +1, loss = -1, draw = 0, all doubled when BOTH players accepted Double or Nothing.
// A pair that both agree to "end the match after this round" leaves the game after it.
//
// Nothing here is enforced by the system except what is an explicit in-game agreement (Double or
// Nothing, ending the match, Forced Rotation). A "promise" is only a note: players may betray it.
import { makeRng } from './schulte';

export type Throw = 'rock' | 'paper' | 'scissors';
export const THROWS: Throw[] = ['rock', 'paper', 'scissors'];
export const THROW_LABEL: Record<Throw, string> = { rock: 'ROCK', paper: 'PAPER', scissors: 'SCISSORS' };
export const THROW_ICON: Record<Throw, string> = { rock: '✊', paper: '✋', scissors: '✌️' };

// '' = nothing said, 'yes' = proposed / accepted, 'no' = rejected.
export type Offer = '' | 'yes' | 'no';

// What a player publishes about one round.
//  - `initial` is PUBLIC: everybody sees it, and it can be changed until the final-throw phase.
//  - `throw` is the FINAL throw: '' (hidden) until the reveal, when everyone's is shown at once.
export type JankenDoc = {
  uid: string;
  k: number; // round number inside the game, 1-based
  dbl: Offer; // Double or Nothing
  term: Offer; // end the match after this round
  promise: '' | Throw; // a non-binding note for the opponent
  initial: '' | Throw; // public INITIAL throw (a bluff or a promise kept: your choice)
  throw: '' | Throw; // FINAL throw, hidden until the reveal
};

export const NEGOTIATION_MS = 30000; // initial throw and offers can change
export const INITIAL_MS = 8000; // time to commit the initial throw before negotiation
export const FINAL_MS = 5000; // last seconds: pick the private FINAL throw (initial throw is locked)
export const REVEAL_MS = 4000; // reveal stays on screen this long
export const WAIT_REVEAL_MS = 6000; // how long to wait for a missing reveal before calling it a no-show
export const MAX_ROUNDS = 10; // safety cap so a table that never agrees cannot play forever
export const SCORE_OFFSET = 500; // result score is saved as 500 + net points (it cannot be negative)

export const beats = (a: Throw, b: Throw) =>
  (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper');

// Forced Rotation: the same throw cannot be used in two rounds in a row.
export const allowedThrows = (prev: Throw | null): Throw[] => THROWS.filter((t) => t !== prev);

export type Deal = 'none' | 'agreed' | 'mine' | 'theirs' | 'rejected-by-them' | 'rejected-by-me';
// What the pair's Double or Nothing / end-match state looks like from my side.
export function dealOf(mine: Offer, theirs: Offer): Deal {
  if (mine === 'yes' && theirs === 'yes') return 'agreed';
  if (mine === 'yes') return theirs === 'no' ? 'rejected-by-them' : 'mine';
  if (theirs === 'yes') return mine === 'no' ? 'rejected-by-me' : 'theirs';
  if (theirs === 'no') return 'rejected-by-them';
  return 'none';
}

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

export type RoundLine = { k: number; a: string; b: string; ta: Throw; tb: Throw; stake: 1 | 2; winner: string | null };
export type Replay = {
  score: Record<string, number>;
  left: string[]; // players who agreed to end the match
  prev: Record<string, Throw | null>; // each player's last throw (for Forced Rotation)
  lines: RoundLine[];
  // The pairings of every round up to the last one replayed (the last one is the round `upTo`).
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
  for (let k = 1; k <= upTo; k++) {
    const active = players.filter((p) => !out.includes(p) && !left.has(p));
    const prevPairs = k > 1 ? rounds[k - 2]?.pairs ?? [] : [];
    const { pairs, bye } = pairings(seed, k, active, prevPairs);
    rounds.push({ pairs, bye });
    const leaving: string[] = [];
    for (const [a, b] of pairs) {
      const da = docOf(docs, a, k);
      const db = docOf(docs, b, k);
      if (da?.throw && db?.throw) {
        const stake: 1 | 2 = dealOf(da.dbl, db.dbl) === 'agreed' ? 2 : 1;
        const winner = beats(da.throw, db.throw) ? a : beats(db.throw, da.throw) ? b : null;
        if (winner) {
          score[winner] += stake;
          score[winner === a ? b : a] -= stake;
        }
        lines.push({ k, a, b, ta: da.throw, tb: db.throw, stake, winner });
        prev[a] = da.throw;
        prev[b] = db.throw;
        if (dealOf(da.term, db.term) === 'agreed') leaving.push(a, b);
      }
    }
    leaving.forEach((p) => left.add(p));
  }
  return { score, left: [...left], prev, lines, rounds };
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