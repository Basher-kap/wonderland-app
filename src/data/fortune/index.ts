import { DAIKYOU } from './daikyou';
import type { FortuneTier, TierBank } from './types';

export type { FortuneQuestion, FortuneTier, TierBank } from './types';

// One question file per luck tier. To add a tier: convert its JSON to <tier>.ts here (same shape
// as daikyou.ts) and list it below. A tier that is missing is simply left out of the 100 slips
// (its slips go to the tiers that exist, see buildDeck in game/fortune.ts).
export const FORTUNE_BANKS: Partial<Record<FortuneTier, TierBank>> = {
  daikyou: DAIKYOU,
};
