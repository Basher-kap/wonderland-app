import { Platform } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

/**
 * Old Maid theme: a sunny Spanish plaza on a warm afternoon. Whitewashed walls with terracotta roofs
 * and arches, a tiled fountain, orange trees and flower beds, a tiled path (azulejos) under the
 * players, and festive bunting strung across the top. Everything is bright and warm; the playing cards
 * are cream with big red / ink indices so they read at a glance, and the card backs show a blue and
 * white tile pattern. Only the Joker's wire (the zap) breaks the mood.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../../assets/images/old-maid-bg.png')
 * Draw the plaza WITHOUT the players, the cards and the benches (they are part of the game screen).
 * While it is null, a built-in placeholder is drawn (PlazaBackground).
 *
 * FONTS: system serif for now. To use a display face later (e.g. Playfair Display from
 * @expo-google-fonts/playfair-display), load it in App.tsx and set FONT_DISPLAY to its name.
 */
export const PLAZA_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_DISPLAY = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Playfair Display", serif',
}) as string;
export const displayWeight = '700' as const;

export const plaza = {
  // sky and walls
  skyTop: '#7EC8E8',
  skyBottom: '#FFE9B8',
  sun: '#FFD25A',
  wall: '#FFF3DC',
  wallShade: '#F2DDB8',
  roof: '#C8553D',
  roofDark: '#9C3A2A',
  arch: '#E8CFA0',
  shadowArch: '#B88B5A',

  // greenery and flowers
  leaf: '#4F9A4B',
  leafDark: '#2F6F36',
  leafLight: '#7DBB5E',
  orange: '#F2A02B',
  trunk: '#7A4B2A',
  petalRed: '#E8403F',
  petalPink: '#F27EA2',
  petalYellow: '#FFC93C',
  petalPurple: '#8F5FD0',

  // ground, fountain, benches
  path: '#E9B872',
  pathDark: '#C98B4A',
  tileBlue: '#2C6FB7',
  tileBlueDark: '#1D4F8C',
  tileWhite: '#F8F4EA',
  tileYellow: '#F5B82E',
  stone: '#D9CDB4',
  stoneDark: '#B7A687',
  water: '#7FD4E6',
  waterDark: '#4FB0CC',
  bench: '#8C5A33',
  benchDark: '#5E3A1E',
  iron: '#3A3A44',

  // the cards
  cardFace: '#FFFDF6',
  cardEdge: '#CDB98A',
  cardRed: '#D32F3C',
  cardInk: '#22252E',
  backBase: '#1F5FA8',
  backAlt: '#F8F4EA',
  backGold: '#F5B82E',
  pick: '#FFC93C',
  pickGlow: 'rgba(255,201,60,0.55)',

  // the chair wire
  zap: '#FFF36B',
  zapGlow: 'rgba(255,243,107,0.55)',
  wire: '#2B2B33',

  // paper and ink (the rules, the tags)
  paper: '#FFF6E2',
  ink: '#3B2A1E',
  inkSoft: '#7A6046',
  title: '#C8553D',
  terracotta: '#C8553D',
  gold: '#E8A93B',
  goldDim: '#B9822A',

  text: '#3B2A1E',
  textDim: '#7A6046',
  onDark: '#FFF6E2',
  good: '#3E9B4F',
  warn: '#D6382F',
} as const;
