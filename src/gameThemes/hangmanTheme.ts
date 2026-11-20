import { Platform } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

/**
 * Hangman theme: a frontier town at dusk. A low sun sits behind the gallows, the gallows stands on
 * a wooden stage with a trapdoor, and the hidden word is the name on a WANTED poster.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../assets/images/hangman-bg.png')
 * It is used behind the rules dialogs (WildWestBackground). The game screen itself is drawn in code
 * (the gallows has to react to every wrong guess), so it does not use the image.
 *
 * FONTS: system slab-serif fonts for now (Rockwell on iPhone). To use Rye (the WANTED title) and
 * Alfa Slab One (letters), install @expo-google-fonts/rye and @expo-google-fonts/alfa-slab-one,
 * load them with useFonts() in App.tsx, then set FONT_DISPLAY to 'Rye_400Regular' or
 * 'AlfaSlabOne_400Regular'. Nothing else needs to change.
 */
export const HANGMAN_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_DISPLAY = Platform.select({
  ios: 'Rockwell',
  android: 'serif',
  default: 'Rockwell, "Roboto Slab", Georgia, serif',
}) as string;
export const FONT_BODY = FONT_DISPLAY;
export const displayWeight = '800' as const;

export const west = {
  // the dusk sky, from the top of the screen down to the horizon
  sky: ['#25122E', '#4A1E3F', '#85304A', '#C4562B', '#E8873F', '#F5B461'],
  sun: '#FFD27A',
  mesaFar: '#5A2338',
  mesaNear: '#3B1727',
  ridge: '#6A2A3A',
  sand: '#9A5A30',
  cactus: '#4A6B38',

  // the stage and the gallows
  wood: '#8A5429',
  woodLight: '#B07A45',
  woodDark: '#4A2B14',
  hemp: '#D8C08A', // the rope
  wall: '#33190F', // the plank wall behind the poster and the keys
  wallLine: '#2A140C',

  // the person on the rope
  ink: '#1B0F0A',
  skin: '#EBC79A',
  hat: '#6B3A1E',
  hatBand: '#B3342B',

  // the WANTED poster, and text on the dark wood
  paper: '#EBD9A8',
  paperEdge: '#BFA46A',
  paperInk: '#2A1A10',
  wanted: '#8C1F1A',
  cream: '#F3E6C4',
  creamMuted: '#CDB98C',

  brass: '#D2A03F',
  brassDark: '#8A6420',
  plate: 'rgba(30,12,18,0.62)', // dark plates laid over the sky

  // keys
  key: '#8A5429',
  keyTop: '#B07A45',
  keyBase: '#4A2B14',
  hit: '#58742E',
  hitBase: '#33471B',
  miss: '#3A1A14',
  missText: '#E2776B',
} as const;
