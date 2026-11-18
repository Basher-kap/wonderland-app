// Daikichi (大吉): great blessing. No questions: every slip is a bonus that auto-passes and heals 20. Converted from daikichi_slips_v2.json.
import type { TierBank } from './types';

export const DAIKICHI: TierBank = {
  tier: 'daikichi',
  label: 'Daikichi (大吉 - Great Blessing)',
  answer_range: null,
  correct_heal: 20,
  min_deduction: 0,
  max_deduction: 0,
  splash_ratio: 0.0,
  total_questions: 0,
  total_slips: 5,
  questions: [
    { id: 'dc_01', fortune: 'In this game, great luck belongs to those who sharpen their minds—while the careless fall to fate, your intellect will carry you to victory.', bonus: true, heal: 20 },
    { id: 'dc_02', fortune: 'Luck in this trial is not blind chance; having a sharp mind brings great fortune to you while those who refuse to think are left behind.', bonus: true, heal: 20 },
    { id: 'dc_03', fortune: 'Where others gamble blindly on fate and perish, a clever mind bends fortune in its favor—stay smart, and great luck will always find you.', bonus: true, heal: 20 },
    { id: 'dc_04', fortune: 'No matter what you do, everything will go well.', bonus: true, heal: 20 },
    { id: 'dc_05', fortune: 'Life is fragile, fleeting, and worth every breath—cherish the second chance granted to you today and keep fighting to live.', bonus: true, heal: 20 },
  ],
};
