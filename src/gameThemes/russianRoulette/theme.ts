import { Platform } from 'react-native';

export const FONT_DEN = Platform.select({
  ios: 'Futura-CondensedExtraBold',
  android: 'sans-serif-condensed',
  default: 'Impact, "Arial Narrow", sans-serif',
}) as string;

export const den = {
  black: '#080506',
  soot: '#120C0B',
  wall: '#1B1210',
  mortar: '#0D0807',
  wood: '#3A2416',
  woodDark: '#24150C',
  woodLight: '#5A3A22',
  steel: '#4A4F57',
  steelDark: '#25282D',
  steelLight: '#8B919B',
  blood: '#8E1117',
  bloodDark: '#4A070B',
  bloodBright: '#D01D24',
  gold: '#B8964A',
  goldDim: '#7D6630',
  bone: '#E8DCC0',
  boneMuted: '#A89E86',
  brass: '#C9A24D',
  copper: '#B5602F',
  panel: 'rgba(12,8,7,0.82)',
} as const;

// The shield force: a blue-green field that protects the player who aimed a blank at themselves. It is
// the only cool colour in the den (everything else is black, dark red and gold), so it reads at once.
export const shieldColors = {
  teal: '#19F0D2',
  blue: '#1AA9FF',
  deep: '#06454F',
  glow: 'rgba(25,240,210,0.32)',
  text: '#BFFFF4',
} as const;

export const CHAMBER_COUNT = 6;
export const SILHOUETTES = 5; // different gambler shapes (Silhouette.tsx)
