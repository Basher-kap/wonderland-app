import { Platform } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import type { ColorId } from '../../game/stroop';

/**
 * Stroop Effect theme: a kid's birthday party. A lilac wall with polka dots, paper streamers and a
 * pennant garland across the top, balloons tied to the edges, confetti on the floor, and a pink
 * gingham tablecloth along the bottom. The decorations are deliberately pink, mint, white and lilac:
 * NONE of the six colors the players have to read (red, blue, green, yellow, purple, orange) is used
 * for decoration, so the party never gives a wrong hint. The word itself hangs on a dark chalkboard
 * sign (the six game colors are all easy to read on it), and the time left is a striped birthday
 * candle that burns down.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../../assets/images/stroop-bg.png')
 * Draw the party WITHOUT the sign, the candle and the buttons (they are part of the game screen), and keep
 * the centre calm. While it is null, a built-in placeholder (PartyBackground) is drawn.
 *
 * FONTS: system fonts for now (Marker Felt on iPhone, sans-serif-black on Android). To use a
 * round display face later (e.g. Baloo 2 or Fredoka from @expo-google-fonts), load it in App.tsx and set
 * FONT_DISPLAY to its name. Nothing else needs to change.
 */
export const PARTY_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_DISPLAY = Platform.select({
  ios: 'Marker Felt',
  android: 'sans-serif-black',
  default: '"Baloo 2", "Trebuchet MS", system-ui, sans-serif',
}) as string;
export const displayWeight = '900' as const;

export const party = {
  // the room
  wall: '#F5E8FF',
  wallDot: '#EAD3FA',
  streamerPink: '#FF8FC2',
  streamerMint: '#62D9C6',
  streamerWhite: '#FFFFFF',
  lavender: '#DCCBF3',
  cloth: '#FF9CC9',
  clothLight: '#FFE1EF',
  balloonPink: '#FF7DB5',
  balloonMint: '#4FCFBB',
  balloonLilac: '#FFC2DE',
  string: '#7A5C99',

  // the sign (a dark chalkboard so every game color is readable)
  signBoard: '#24103F',
  signEdge: '#FF8FC2',
  signTape: '#FFFFFF',
  signText: '#F5E8FF',

  // the candle
  wax: '#FFFFFF',
  waxStripe: '#FF8FC2',
  wick: '#3A1B5C',
  flame: '#FFB020',
  flameCore: '#FFF3B0',

  // ink and paper (the rules, the labels)
  ink: '#3A1B5C',
  inkSoft: '#7A5C99',
  paper: '#FFF9FD',
  title: '#E0398A',
  accent: '#E0398A',
  mint: '#1BA391',

  good: '#1BA391',
  bad: '#D93360',
  panel: 'rgba(255,249,253,0.94)',
} as const;

// The six game colors, as seen on the dark sign and on the buttons.
export const INK: Record<ColorId, string> = {
  red: '#FF4D4D',
  blue: '#4DA8FF',
  green: '#3FE07A',
  yellow: '#FFD93B',
  purple: '#B57BFF',
  orange: '#FF9A2E',
};
