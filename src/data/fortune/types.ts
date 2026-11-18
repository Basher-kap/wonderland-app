// The shape of one tier's question file (the JSON you send, converted to a .ts file in this folder).
export type FortuneTier = 'daikichi' | 'chuukichi' | 'shokichi' | 'kichi' | 'kyou' | 'daikyou';

export type FortuneQuestion = {
  id: string;
  fortune: string; // the fortune read on the slip
  q?: string; // the numerical question (a Daikichi slip has none: it is a bonus)
  a?: number; // the exact answer
  bonus?: boolean; // Daikichi only: auto-passes, no question to answer
  heal?: number; // Daikichi only: life restored by this bonus slip
};

export type TierBank = {
  tier: FortuneTier;
  label: string;
  answer_range: [number, number] | null; // null for Daikichi (no questions)
  correct_heal: number;
  min_deduction: number;
  max_deduction: number;
  splash_ratio: number;
  total_questions: number; // number of questions (0 for Daikichi)
  total_slips?: number; // Daikichi only: number of bonus slips
  questions: FortuneQuestion[]; // for Daikichi these are the bonus slips
};
