// Light Bulb: pure board logic, no React, no Firebase. Test with the same tsc + node flow as engine.ts.
//
// HIDDEN NOTES (NOT listed in data/games.ts on purpose, the players are not told):
//   - 8 switches along the top, 8 terminals along the bottom: 1 light bulb and 7 TNT charges.
//   - Every wire is the same grey. They are braided: the wires swap places with a neighbour again
//     and again on the way down, so the switch right above the bulb is almost never the right one.
//   - 1 minute on the fuse, ONE attempt. A wrong switch or the fuse running out = explosion.
//   - The round ends for everybody as soon as one player lights the bulb (registry: endsOnFirstFinish).
//
// The board is built from `seed` only, so every player in a round gets the SAME tangle.
import { makeRng } from './schulte';

export const SWITCH_COUNT = 8;
export const TIME_LIMIT_MS = 60_000;
// How many times the wires can swap places on the way down. More bands = a harder trace.
export const BANDS = 15;
// Bands that never swap anything, so the fallen beam drawn over them can hide a stretch of the
// wires without making the trace a guess (a wire that goes in straight comes out straight).
export const BEAM_BANDS: readonly number[] = [4, 10];
const SWAP_CHANCE = 0.7;
// The wire to the bulb must take at least this many swaps, or the trace is too easy.
const MIN_BULB_SWAPS = 5;

export type Board = {
  // lanes[r][w] = the lane (0..7, left to right) wire `w` is in at level r (r = 0..BANDS).
  // Wire w starts in lane w (below switch w) and ends in lanes[BANDS][w].
  lanes: number[][];
  // swapsBetween[r] = the pairs [a, a+1] of lanes that trade places between level r and r+1.
  swapsBetween: number[][];
  // terminal (lane at the bottom) of every switch
  terminalOf: number[];
  // the lane at the bottom where the bulb is; every other terminal is TNT
  bulbTerminal: number;
  // the ONE switch that lights the bulb
  correctSwitch: number;
  // per wire and level, a small sideways wobble in -1..1 (units of a fraction of a lane),
  // so the wires do not look like they were drawn on a grid
  wobble: number[][];
  // the order the wires are painted in, so who crosses over whom differs from wire to wire
  paintOrder: number[];
};

function build(seed: string): Board {
  const rnd = makeRng(`${seed}:lightbulb`);
  // lane -> wire currently in that lane
  let occupant = Array.from({ length: SWITCH_COUNT }, (_, i) => i);
  const lanes: number[][] = [Array.from({ length: SWITCH_COUNT }, (_, w) => w)];
  const swapsBetween: number[][] = [];
  for (let r = 0; r < BANDS; r++) {
    const pairs: number[] = [];
    if (!BEAM_BANDS.includes(r)) {
      // A random set of neighbour swaps that do not touch each other.
      let a = rnd() < 0.5 ? 0 : 1; // start at lane 0 or 1 so the pairs shift from band to band
      while (a + 1 < SWITCH_COUNT) {
        if (rnd() < SWAP_CHANCE) {
          pairs.push(a);
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
    const laneOf = new Array<number>(SWITCH_COUNT);
    occupant.forEach((wire, lane) => (laneOf[wire] = lane));
    lanes.push(laneOf);
  }
  const terminalOf = lanes[BANDS].slice();
  const bulbTerminal = Math.floor(rnd() * SWITCH_COUNT);
  const correctSwitch = terminalOf.indexOf(bulbTerminal);
  const wobble = lanes.map(() => Array.from({ length: SWITCH_COUNT }, () => rnd() * 2 - 1));
  // Fisher-Yates on the paint order
  const paintOrder = Array.from({ length: SWITCH_COUNT }, (_, i) => i);
  for (let i = paintOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [paintOrder[i], paintOrder[j]] = [paintOrder[j], paintOrder[i]];
  }
  return { lanes, swapsBetween, terminalOf, bulbTerminal, correctSwitch, wobble, paintOrder };
}

// How many times a wire changes lane on its way down.
export function swapCount(board: Board, wire: number): number {
  let n = 0;
  for (let r = 0; r < BANDS; r++) if (board.lanes[r][wire] !== board.lanes[r + 1][wire]) n++;
  return n;
}

// The board of a round. A board whose right switch is straight above the bulb, or whose bulb wire
// hardly moves, is thrown away (a new one is drawn from the same seed, so it stays the same for everybody).
export function buildBoard(seed: string): Board {
  let board = build(seed);
  for (let n = 1; n <= 50; n++) {
    if (board.correctSwitch !== board.bulbTerminal && swapCount(board, board.correctSwitch) >= MIN_BULB_SWAPS) break;
    board = build(`${seed}#${n}`);
  }
  return board;
}

export type Pick = 'lit' | 'boom';

// ONE attempt: the right switch lights the bulb, any other one sets off the TNT.
export const flip = (board: Board, picked: number): Pick => (picked === board.correctSwitch ? 'lit' : 'boom');

export const remainingMs = (elapsedMs: number) => Math.max(0, TIME_LIMIT_MS - elapsedMs);
export const isExpired = (elapsedMs: number) => elapsedMs >= TIME_LIMIT_MS;

// The winner is whoever lit the bulb first (shortest time). Nobody lit it = a draw.
// Same rule as Schulte Table: an exact tie is a draw.
export { pickWinner } from './schulte';
