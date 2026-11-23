// Memory Card: pure board and clock logic, no React, no Firebase. Test with the same tsc + node flow as engine.ts.
//
// HIDDEN NOTES (NOT listed in data/games.ts on purpose, the players are not told):
//   - 18 cards face down, only 3 icons (brain = Logic, earth = Experience, dice = Chance), 6 cards of each.
//     Any two cards with the same icon match, so there are 9 pairs to find.
//   - EVERYBODY plays the same board (same cards, same positions, from `seed`) on their own screen, and the
//     turns run on a shared beat: 3 seconds to be ready, then a 3-second window in which each player flips
//     2 cards. Then the next beat starts. The beat starts when the round starts, which GameScreen does for
//     all players together once the rules have been read.
//   - Flipping fewer than 2 cards in the window wastes that turn (the card you did flip turns back over).
//   - The player who turns over the last pair ends the game for everybody (registry: endsOnFirstFinish). If two
//     players clear it in the same window, whoever flipped the last card first wins (totalMs is the moment).
//   - Safety cap (MAX_TURNS): if nobody has cleared the board by then the round is a draw.
import { makeRng } from './schulte';

export type Icon = 'brain' | 'earth' | 'dice';
export const ICONS: readonly Icon[] = ['brain', 'earth', 'dice'];
export const PER_ICON = 6;
export const CARD_COUNT = ICONS.length * PER_ICON; // 18
export const PAIR_COUNT = CARD_COUNT / 2; // 9

export const READY_MS = 3000; // 3 seconds to be ready
export const FLIP_MS = 3000; // 3 seconds to flip 2 cards
export const CYCLE_MS = READY_MS + FLIP_MS;
export const MAX_TURNS = 40;

// The icons of the 18 cards, in board order. The same seed gives everybody the same board.
export function layout(seed: string): Icon[] {
  const rnd = makeRng(`${seed}:memorycard`);
  const cards: Icon[] = [];
  for (const icon of ICONS) for (let n = 0; n < PER_ICON; n++) cards.push(icon);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export type Phase = 'ready' | 'flip';
export type Beat = { turn: number; phase: Phase; msLeft: number };

// Where the shared beat is, `elapsedMs` after the round started. Turn 0 begins with a ready period.
export function beatAt(elapsedMs: number): Beat {
  const ms = Math.max(0, elapsedMs);
  const turn = Math.floor(ms / CYCLE_MS);
  const within = ms - turn * CYCLE_MS;
  return within < READY_MS
    ? { turn, phase: 'ready', msLeft: READY_MS - within }
    : { turn, phase: 'flip', msLeft: CYCLE_MS - within };
}

export type State = {
  matched: boolean[]; // cards that are part of a found pair
  picks: number[]; // the cards flipped in the current window (0-2) that are NOT a match
  doneTurn: number; // the turn in which both flips were used (-1 = none yet)
};

export const newState = (): State => ({ matched: Array.from({ length: CARD_COUNT }, () => false), picks: [], doneTurn: -1 });

export const matchedPairs = (s: State) => s.matched.filter(Boolean).length / 2;
export const isCleared = (s: State) => s.matched.every(Boolean);

export type PickResult = 'first' | 'match' | 'miss' | 'ignored';

// Flip card `i` during `turn` (only valid in the flip window; the screen checks that).
// A turn allows 2 flips: after the second, nothing else can be flipped until the next turn.
export function pick(s: State, cards: Icon[], i: number, turn: number): { state: State; result: PickResult } {
  if (i < 0 || i >= CARD_COUNT || s.matched[i] || s.picks.includes(i) || s.doneTurn === turn) return { state: s, result: 'ignored' };
  const picks = [...s.picks, i];
  if (picks.length === 1) return { state: { ...s, picks }, result: 'first' };
  const [a, b] = picks;
  if (cards[a] === cards[b]) {
    const matched = s.matched.slice();
    matched[a] = true;
    matched[b] = true;
    return { state: { matched, picks: [], doneTurn: turn }, result: 'match' };
  }
  return { state: { ...s, picks, doneTurn: turn }, result: 'miss' };
}

// The window is over: the cards that did not match turn back over (a single flip is wasted too).
export const endTurn = (s: State): State => (s.picks.length ? { ...s, picks: [] } : s);

// The winner is whoever cleared the board first (shortest time). Nobody cleared it = a draw.
export { pickWinner } from './schulte';
