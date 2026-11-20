import type { ImageSourcePropType } from 'react-native';
import { colors } from './theme';

/**
 * Space theme for Home, Leaderboard, Settings and Lobby.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../assets/images/space-bg.png')
 * While it is null, SpaceBackground draws a built-in placeholder (deep-space colours + stars).
 */
export const SPACE_BG_IMAGE: ImageSourcePropType | null = null;

export const space = {
  // placeholder background layers (used only while SPACE_BG_IMAGE is null)
  bgDeep: colors.bg,
  bgMid: '#1F1B55',
  bgGlowA: '#5B3FB8', // violet nebula
  bgGlowB: '#1B5E8C', // blue nebula
  star: '#FFFFFF',

  // dark layer over YOUR image so text stays readable (0 = none, 1 = black)
  imageDim: 0.35,

  // panels that sit on top of the background: same purples as theme.ts, a little see-through
  card: 'rgba(38, 33, 92, 0.78)', // colors.card
  cardAlt: 'rgba(47, 42, 110, 0.82)', // colors.cardAlt
  input: 'rgba(23, 20, 58, 0.75)', // colors.bg
  border: 'rgba(120, 110, 220, 0.45)',
} as const;
