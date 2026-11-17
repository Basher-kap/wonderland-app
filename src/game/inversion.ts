// Inversion: pure logic, no React, no Firebase.
// A task shows moving or pointing arrows and an instruction ("Press RIGHT if the arrows are NOT
// moving to the left"). The player presses one of TWO buttons (LEFT/RIGHT or UP/DOWN). When the
// INVERSED sign is on, the opposite button is the right one. Every player gets the same tasks
// (from the seed) and plays them at their own pace; a wrong button or running out of time costs
// one of the 3 chances.
import { makeRng } from './schulte';

export const TASK_COUNT = 30;
export const MAX_CHANCES = 3;

export type Dir = 'left' | 'right' | 'up' | 'down';
export type Axis = 'horizontal' | 'vertical';
export type Mode = 'moving' | 'pointing';

export const PAIR: Record<Axis, [Dir, Dir]> = { horizontal: ['left', 'right'], vertical: ['up', 'down'] };
export const opposite = (d: Dir): Dir =>
  d === 'left' ? 'right' : d === 'right' ? 'left' : d === 'up' ? 'down' : 'up';

export type Task = {
  axis: Axis;
  mode: Mode;
  dir: Dir; // where the arrows move / point
  button: Dir; // "Press <button> if ..."
  negated: boolean; // "... are NOT moving to the <target>"
  target: Dir; // the direction the instruction talks about
  inversed: boolean; // the INVERSED sign is on
  inverseApproach: boolean; // the instruction is not the plain "Press RIGHT if moving right"
  text: string;
  answer: Dir; // the button that is correct (already takes INVERSED into account)
  timeLimitMs: number;
};

// How the game gets harder (all tuning constants live here).
const FIRST_PLAIN_TASKS = 3; // the first tasks are plain: direct instruction, no INVERSED sign
const INVERSED_CHANCE = 0.35;
const INVERSE_APPROACH_START = 0.1; // chance of an inverse-approach instruction on task 1...
const INVERSE_APPROACH_END = 0.7; // ...rising to this on the last task
const TIME_LIMIT_START = 4200; // ms to answer task 1...
const TIME_LIMIT_END = 2400; // ...shrinking to this on the last task

const progress = (index: number) => Math.min(1, Math.max(0, index / (TASK_COUNT - 1)));
export const timeLimitFor = (index: number) =>
  Math.round(TIME_LIMIT_START + (TIME_LIMIT_END - TIME_LIMIT_START) * progress(index));
export const inverseApproachChance = (index: number) =>
  index < FIRST_PLAIN_TASKS ? 0 : INVERSE_APPROACH_START + (INVERSE_APPROACH_END - INVERSE_APPROACH_START) * progress(index);

const phrase = (axis: Axis, mode: Mode, target: Dir): string => {
  if (axis === 'horizontal') return `${mode} to the ${target}`;
  return `${mode === 'moving' ? 'going' : 'pointing'} ${target === 'up' ? 'upwards' : 'downwards'}`;
};

export const instructionText = (axis: Axis, mode: Mode, button: Dir, negated: boolean, target: Dir) =>
  `Press ${button.toUpperCase()} if the arrows are ${negated ? 'NOT ' : ''}${phrase(axis, mode, target)}`;

// The button the instruction asks for, before the INVERSED sign. The arrows either move or point
// (the instruction always talks about what they are doing), so only the direction matters. The
// condition is true -> press `button`; false -> the other button.
export function plainAnswer(dir: Dir, button: Dir, negated: boolean, target: Dir): Dir {
  const condition = negated ? dir !== target : dir === target;
  return condition ? button : opposite(button);
}

export function makeTask(seed: string, index: number): Task {
  const rnd = makeRng(`${seed}:inv:${index}`);
  const axis: Axis = rnd() < 0.5 ? 'horizontal' : 'vertical';
  const mode: Mode = rnd() < 0.5 ? 'moving' : 'pointing';
  const pair = PAIR[axis];
  const dir = pair[rnd() < 0.5 ? 0 : 1];
  const inverseApproach = rnd() < inverseApproachChance(index);
  const inversed = index >= FIRST_PLAIN_TASKS && rnd() < INVERSED_CHANCE;

  let button: Dir;
  let negated: boolean;
  let target: Dir;
  if (inverseApproach) {
    // Every combination except the direct "Press X if ... X": 6 of the 8.
    const combos: [Dir, boolean, Dir][] = [];
    for (const b of pair) for (const n of [false, true]) for (const t of pair) if (!(b === t && !n)) combos.push([b, n, t]);
    [button, negated, target] = combos[Math.floor(rnd() * combos.length)];
  } else {
    button = target = pair[rnd() < 0.5 ? 0 : 1];
    negated = false;
  }

  const press = plainAnswer(dir, button, negated, target);
  return {
    axis,
    mode,
    dir,
    button,
    negated,
    target,
    inversed,
    inverseApproach,
    text: instructionText(axis, mode, button, negated, target),
    answer: inversed ? opposite(press) : press,
    timeLimitMs: timeLimitFor(index),
  };
}

// Winner. Results: finished = completed every task, score = tasks answered correctly,
// totalMs = how long the player lasted. Forfeited players (and anybody who ran out of chances)
// are out.
//  1. The first player to complete all the tasks wins (the fastest, if several did).
//  2. Otherwise the last player still in the game wins (`playerIds` lets us see who has not
//     handed in a result, i.e. is still playing).
//  3. If everybody is out: most correct answers, then the one who lasted longest. A tie = draw.
export type Result = { uid: string; finished: boolean; totalMs: number; score?: number; forfeited?: boolean };

export function pickWinner(results: Result[], playerIds?: string[]): string | null {
  const finishers = results.filter((r) => r.finished && !r.forfeited).sort((a, b) => a.totalMs - b.totalMs);
  if (finishers.length > 0) {
    if (finishers.length > 1 && finishers[0].totalMs === finishers[1].totalMs) return null;
    return finishers[0].uid;
  }
  if (playerIds) {
    const stillIn = playerIds.filter((id) => !results.some((r) => r.uid === id));
    if (stillIn.length === 1) return stillIn[0];
    if (stillIn.length > 1) return null; // not over yet
  }
  const out = results
    .filter((r) => !r.forfeited)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.totalMs - a.totalMs);
  if (out.length === 0) return null;
  if (
    out.length > 1 &&
    (out[0].score ?? 0) === (out[1].score ?? 0) &&
    out[0].totalMs === out[1].totalMs
  )
    return null;
  return out[0].uid;
}

export const describeResult = (r: Result) =>
  r.finished ? `completed all ${TASK_COUNT} tasks` : `out after ${r.score ?? 0} correct`;
