import { Platform } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

/**
 * Fortune theme: a night festival (matsuri) with a small shrine where people pray for luck.
 * Paper lanterns over the stalls, a torii gate, a stone lantern, and the little shrine you tap to
 * draw your fortune. The slips are real omikuji paper.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../assets/images/fortune-bg.png')
 * Draw the festival WITHOUT the shrine (the shrine is part of the game screen). While it is null,
 * FestivalBackground draws the built-in placeholder scene.
 *
 * FONT: a Japanese serif (Mincho) where the phone has one, the system serif elsewhere. Change
 * FONT_FORTUNE here and the game screen and the rules dialogs follow.
 */
export const FORTUNE_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_FORTUNE = Platform.select({
  ios: 'Hiragino Mincho ProN',
  android: 'serif',
  default: 'serif',
}) as string;

export const fortune = {
  // night sky, top to horizon
  sky1: '#0A1020',
  sky2: '#0E1830',
  sky3: '#13203A',
  sky4: '#1A2A48',
  sky5: '#2A2F52',
  sky6: '#4A3140',
  moon: '#F4E9C8',

  vermilion: '#D6402B', // lanterns, torii
  vermilionDark: '#B3261E', // headings on paper
  vermilionDeep: '#7A2012',
  lantern: '#FFB347', // lantern glow, the lit window
  lanternSoft: '#FFD08A',
  gold: '#E0B04A', // bells, trims, the coin button

  wood: '#2A1810', // shrine wood, panels
  woodLight: '#3A2218',
  woodEdge: '#5A3A28',
  roof: '#1E1410',
  pine: '#0F2820',
  stone: '#3A3A44',
  ground: '#1B1512',

  paper: '#F3E6C8', // omikuji slips, rules dialogs
  paperEdge: '#D9C79A',
  ink: '#2A1810',
  inkMuted: '#6B4F3A',
  textSoft: '#E8D9B0', // muted text on the dark panels

  lifeGood: '#6FBF73',
  lifeMid: '#E0B04A',
  lifeLow: '#E4533C',
  hot: '#FF7A5C', // the last seconds, on dark
  hotOnPaper: '#B3261E', // the last seconds, on a slip
} as const;

// The luck colours, darkened to read on the paper of a slip.
export const TIER_INK: Record<'daikichi' | 'chuukichi' | 'shokichi' | 'kichi' | 'kyou' | 'daikyou', string> = {
  daikichi: '#A66F00',
  chuukichi: '#B35A00',
  shokichi: '#1F7A5C',
  kichi: '#4B4590',
  kyou: '#B03A48',
  daikyou: '#8E1B1B',
};
