// Light Bulb: pure board logic, no React, no Firebase. Test with the same tsc + node flow as engine.ts.
//
// HIDDEN NOTES (NOT listed in data/games.ts on purpose, the players are not told):
//   - 8 switches along the top, 8 terminals along the bottom: 1 light bulb and 7 TNT charges.
//   - Every wire is the same grey. They are braided hard: the wires swap places with a neighbour again
//     and again on the way down (BANDS bands, most of them with several swaps), the swaps of different
//     pairs happen at different heights, the bands are of uneven height, every wire drifts sideways on its
//     own slow curve, and in the middle the whole bundle squeezes together (PITCH_MIN) so the wires lie
//     close and cross at steep angles. The switch right above the bulb is never the right one, and the
//     wire to the bulb never runs straight for long.
//   - 1 minute on the fuse, ONE attempt. A wrong switch or the fuse running out = explosion.
//   - The round ends for everybody as soon as one player lights the bulb (registry: endsOnFirstFinish).
//
// The board is built from `seed` only, so every player in a round gets the SAME tangle.
import { makeRng } from './schulte';

export const SWITCH_COUNT = 8;
export const TIME_LIMIT_MS = 60_000;
// How many times the wires can swap places on the way down. More bands = a harder trace.
export const BANDS = 26;
// Bands that never swap anything, so the fallen beam drawn over them can hide a stretch of the
// wires without making the trace a guess (a wire that goes in straight comes out straight).
export const BEAM_BANDS: readonly number[] = [6, 13, 20];
const SWAP_CHANCE = 0.85;
// The wire to the bulb must take at least this many swaps, and may not run straight for more than
// MAX_STRAIGHT bands in a row (the beam bands do not count: nobody can see through them anyway).
const MIN_BULB_SWAPS = 11;
const MAX_STRAIGHT = 3;
// In the middle of the board the lanes are only this fraction of their normal distance apart.
export const PITCH_MIN = 0.42;
// The sideways drift of a wire, in lanes (it stays well under half the squeezed lane distance so two
// wires only ever meet where they really swap).
const DRIFT_MAX = 0.2;

export type Board = {
  // lanes[r][w] = the lane (0..7, left to right) wire `w` is in at level r (r = 0..BANDS).
  // Wire w starts in lane w (below switch w) and ends in lanes[BANDS][w].
  lanes: number[][];
  // swapsBetween[r] = the pairs [a, a+1] of lanes that trade places between level r and r+1.
  swapsBetween: number[][];
  // timing[r][a] = for the swap of lanes a and a+1 in band r: the stretch of the band (0..1) it takes
  // place in, so the crossings of different pairs are not lined up in rows
  timing: Record<number, { s: number; e: number }>[];
  // terminal (lane at the bottom) of every switch
  terminalOf: number[];
  // the lane at the bottom where the bulb is; every other terminal is TNT
  bulbTerminal: number;
  // the ONE switch that lights the bulb
  correctSwitch: number;
  // how far down (0..1) each level is: the bands are of uneven height. bandTop[0] = 0, bandTop[BANDS] = 1.
  bandTop: number[];
  // the slow sideways drift of each wire: amplitude (lanes), turns over the whole board, phase (0..1)
  drift: { amp: number; turns: number; phase: number }[];
  // the order the wires are painted in, so who crosses over whom differs from wire to wire
  paintOrder: number[];
};

function build(seed: string): Board {
  const rnd = makeRng(`${seed}:lightbulb2`);
  // lane -> wire currently in that lane
  let occupant = Array.from({ length: SWITCH_COUNT }, (_, i) => i);
  const lanes: number[][] = [Array.from({ length: SWITCH_COUNT }, (_, w) => w)];
  const swapsBetween: number[][] = [];
  const timing: Record<number, { s: number; e: number }>[] = [];
  for (let r = 0; r < BANDS; r++) {
    const pairs: number[] = [];
    const t: Record<number, { s: number; e: number }> = {};
    if (!BEAM_BANDS.includes(r)) {
      // A random set of neighbour swaps that do not touch each other.
      let a = rnd() < 0.5 ? 0 : 1; // start at lane 0 or 1 so the pairs shift from band to band
      while (a + 1 < SWITCH_COUNT) {
        if (rnd() < SWAP_CHANCE) {
          pairs.push(a);
          const s = rnd() * 0.45;
          t[a] = { s, e: Math.min(1, s + 0.5 + rnd() * 0.4) };
          a += 2;
        } else {
          a += 1;
        }
      }
    }
    const next = occupant.slice();
    for (const a of pairs) {
      next[a] = occupant[a + 1];
      next[a + 1] = occupant[a];
    }
    occupant = next;
    swapsBetween.push(pairs);
    timing.push(t);
    const laneOf = new Array<number>(SWITCH_COUNT);
    occupant.forEach((wire, lane) => (laneOf[wire] = lane));
    lanes.push(laneOf);
  }
  const terminalOf = lanes[BANDS].slice();
  const bulbTerminal = Math.floor(rnd() * SWITCH_COUNT);
  const correctSwitch = terminalOf.indexOf(bulbTerminal);
  // Uneven bands: each is between 0.55 and 1.55 times the average height.
  const weights = Array.from({ length: BANDS }, () => 0.55 + rnd());
  const sum = weights.reduce((a, b) => a + b, 0);
  const bandTop = [0];
  for (const w of weights) bandTop.push(bandTop[bandTop.length - 1] + w / sum);
  bandTop[BANDS] = 1;
  const drift = Array.from({ length: SWITCH_COUNT }, () => ({
    amp: DRIFT_MAX * (0.45 + rnd() * 0.55),
    turns: 1.5 + rnd() * 3.5,
    phase: rnd(),
  }));
  // Fisher-Yates on the paint order
  const paintOrder = Array.from({ length: SWITCH_COUNT }, (_, i) => i);
  for (let i = paintOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [paintOrder[i], paintOrder[j]] = [paintOrder[j], paintOrder[i]];
  }
  return { lanes, swapsBetween, timing, terminalOf, bulbTerminal, correctSwitch, bandTop, drift, paintOrder };
}

// How many times a wire changes lane on its way down.
export function swapCount(board: Board, wire: number): number {
  let n = 0;
  for (let r = 0; r < BANDS; r++) if (board.lanes[r][wire] !== board.lanes[r + 1][wire]) n++;
  return n;
}

// The longest stretch of bands in which a wire stays in its lane (beam bands not counted).
export function longestStraight(board: Board, wire: number): number {
  let best = 0;
  let run = 0;
  for (let r = 0; r < BANDS; r++) {
    if (BEAM_BANDS.includes(r)) continue;
    if (board.lanes[r][wire] === board.lanes[r + 1][wire]) run++;
    else run = 0;
    best = Math.max(best, run);
  }
  return best;
}

// The board of a round. A board that is too easy is thrown away (a new one is drawn from the same seed,
// so it stays the same for everybody): the right switch straight above the bulb or next to it, a bulb wire
// with too few swaps, or one that runs straight for too long.
export function buildBoard(seed: string): Board {
  const ok = (b: Board) =>
    Math.abs(b.correctSwitch - b.bulbTerminal) >= 2 &&
    swapCount(b, b.correctSwitch) >= MIN_BULB_SWAPS &&
    longestStraight(b, b.correctSwitch) <= MAX_STRAIGHT;
  let board = build(seed);
  for (let n = 1; n <= 200 && !ok(board); n++) board = build(`${seed}#${n}`);
  return board;
}

// ---- geometry: where a wire is, as a function of how far down the board it is ----
// `u` runs 0..BANDS (the level, fractional). Everything here is in lane units, so the screen only has to
// scale it to pixels. This is shared by the screen and the tests.

const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

// The lane distance factor at level u: 1 at the switches and the terminals (so each wire lands exactly
// under its switch / on its terminal) and PITCH_MIN in the middle (the bundle is squeezed together).
export const pitchAt = (u: number) => {
  const s = Math.max(0, Math.sin((Math.PI * Math.max(0, Math.min(BANDS, u))) / BANDS)); // rounding can make it a hair below 0
  return 1 - (1 - PITCH_MIN) * Math.min(1, s * 1.25);
};

// How far down the board (0..1) level u is: the bands are of uneven height.
export function depthAt(board: Board, u: number): number {
  const c = Math.max(0, Math.min(BANDS, u));
  const r = Math.min(BANDS - 1, Math.floor(c));
  return board.bandTop[r] + (board.bandTop[r + 1] - board.bandTop[r]) * (c - r);
}

// The lane (fractional, 0..7) wire `w` is in at level u: its lane, moved a smooth S-curve into the next
// lane while it swaps, plus its own slow drift (zero at both ends).
export function laneAt(board: Board, w: number, u: number): number {
  const c = Math.max(0, Math.min(BANDS, u));
  const r = Math.min(BANDS - 1, Math.floor(c));
  const f = c - r;
  const from = board.lanes[r][w];
  const to = board.lanes[r + 1][w];
  let lane = from;
  if (from !== to) {
    const t = board.timing[r][Math.min(from, to)];
    lane = from + (to - from) * smooth((f - t.s) / (t.e - t.s));
  }
  const d = board.drift[w];
  // A flat-topped envelope (zero at both ends) so the wires wander right from the switches, and two
  // waves of different speed so no wire follows a path you could guess.
  // (sin of the very last level can come out a hair below 0, and a negative number to a fractional power is NaN)
  const env = Math.pow(Math.max(0, Math.sin((Math.PI * c) / BANDS)), 0.6);
  const x = c / BANDS;
  const wave = 0.7 * Math.sin(2 * Math.PI * (d.turns * x + d.phase)) + 0.3 * Math.sin(2 * Math.PI * (d.turns * 2.3 * x + d.phase * 3));
  return lane + d.amp * env * wave;
}

export type Pick = 'lit' | 'boom';

// ONE attempt: the right switch lights the bulb, any other one sets off the TNT.
export const flip = (board: Board, picked: number): Pick => (picked === board.correctSwitch ? 'lit' : 'boom');

export const remainingMs = (elapsedMs: number) => Math.max(0, TIME_LIMIT_MS - elapsedMs);
export const isExpired = (elapsedMs: number) => elapsedMs >= TIME_LIMIT_MS;

// The winner is whoever lit the bulb first (shortest time). Nobody lit it = a draw.
// Same rule as Schulte Table: an exact tie is a draw.
export { pickWinner } from './schulte';
