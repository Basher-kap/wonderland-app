// The shape of one tier's question file (the JSON you send, converted to a .ts file in this folder).
export type FortuneTier = 'daikichi' | 'chuukichi' | 'shokichi' | 'kichi' | 'kyou' | 'daikyou';

export type FortuneQuestion = {
  id: string;
  fortune: string; // the fortune read on the slip
  q?: string; // the numerical question (a Daikichi slip has none: it is a bonus)
  a?: number; // the exact answer
};

export type TierBank = {
  tier: FortuneTier;
  label: string;
  answer_range: [number, number];
  correct_heal: number;
  min_deduction: number;
  max_deduction: number;
  splash_ratio: number;
  total_questions: number;
  questions: FortuneQuestion[];
};
