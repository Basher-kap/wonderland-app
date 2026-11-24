// Beauty Contest: the timing of the reveal, step by step. Pure, no React, no Firebase.
//
// The reveal is shown in two screens, one after the other:
//   1. THE NUMBERS: the contestants appear one by one with the number they chose; below them the
//      calculation appears bit by bit (sum, average, target, the numbers that are invalid), then each
//      contestant's distance from the target, then the winner of the round.
//   2. THE SCORES: the contestants appear again with the points they lost in this round; then the
//      players who are out and the new special rule (if any).
// Then the next round starts and the number pad comes back.
//
// All the times are in ms from the start of the reveal. The HOST uses `revealMs` to decide how long
// the reveal lasts (a bigger table takes longer to show than a small one) and every phone uses
// `buildTimeline` to know what to show at which moment, so both come from the same numbers.
import type { Reveal } from './beautyContest';

export const PLAYERS_LEAD = 300; // before the first contestant appears
export const PLAYER_STEP = 350; // between two contestants appearing
export const CALC_PAUSE = 700; // after the last contestant, before the calculation starts
export const CALC_STEP = 850; // between two lines of the calculation
export const AWAY_STEP = 450; // between two "off by" notes
export const WINNER_LEAD = 400; // after the last note, before the winner is announced
export const WINNER_HOLD = 2600; // the winner stays on screen this long before the scores
export const SCORE_LEAD = 300;
export const SCORE_STEP = 260; // between two score rows
export const SCORE_SETTLE = 450; // a score row first shows the old points, then the new ones
export const NOTICE_LEAD = 900; // after the last score row, before "game over" / "new rule"
export const NOTICE_HOLD = 3600; // time to read them
export const END_HOLD = 2200; // the last screen stays a little before the next round

export type CalcKind = 'sum' | 'average' | 'target' | 'invalid' | 'none';

export type Timeline = {
  playersAt: number[]; // per row (same order as reveal.rows): when the contestant appears
  calc: { kind: CalcKind; at: number }[]; // the lines of the calculation
  awayAt: number[]; // per row: when "off by ..." appears (-1: this row is never compared)
  invalidAt: number; // when the invalid marks appear (-1: nothing is invalid)
  winnerAt: number; // when the winner of the round is announced
  scoresStart: number; // when the second screen (the scores) replaces the first
  scoresAt: number[]; // per row: when its score row appears
  noticeAt: number; // when "game over" / "new rule" appear (-1: nothing to announce)
  totalMs: number; // how long the whole reveal lasts
};

export function buildTimeline(v: Reveal): Timeline {
  const rows = v.rows;
  let t = PLAYERS_LEAD;
  const playersAt = rows.map((_, i) => PLAYERS_LEAD + i * PLAYER_STEP);
  t = PLAYERS_LEAD + Math.max(0, rows.length - 1) * PLAYER_STEP + CALC_PAUSE;

  const calc: Timeline['calc'] = [];
  const awayAt = rows.map(() => -1);
  let invalidAt = -1;

  if (v.target === null) {
    calc.push({ kind: 'none', at: t });
    t += CALC_STEP;
  } else {
    calc.push({ kind: 'sum', at: t });
    t += CALC_STEP;
    calc.push({ kind: 'average', at: t });
    t += CALC_STEP;
    calc.push({ kind: 'target', at: t });
    t += CALC_STEP;
    rows.forEach((r, i) => {
      if (r.away !== null) {
        awayAt[i] = t;
        t += AWAY_STEP;
      }
    });
    if (rows.some((r) => r.status === 'invalid')) {
      invalidAt = t;
      calc.push({ kind: 'invalid', at: t });
      t += CALC_STEP;
    }
  }

  const winnerAt = t + WINNER_LEAD;
  const scoresStart = winnerAt + WINNER_HOLD;
  const scoresAt = rows.map((_, i) => scoresStart + SCORE_LEAD + i * SCORE_STEP);
  t = scoresStart + SCORE_LEAD + Math.max(0, rows.length - 1) * SCORE_STEP + SCORE_SETTLE;

  let noticeAt = -1;
  if (v.out.length > 0 || v.newRules.length > 0) {
    noticeAt = t + NOTICE_LEAD;
    t = noticeAt + NOTICE_HOLD;
  } else {
    t += 600;
  }
  return { playersAt, calc, awayAt, invalidAt, winnerAt, scoresStart, scoresAt, noticeAt, totalMs: t + END_HOLD };
}

// How long the host keeps the reveal on screen.
export const revealMs = (v: Reveal): number => buildTimeline(v).totalMs;
