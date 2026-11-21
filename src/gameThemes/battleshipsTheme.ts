import { Platform } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

/**
 * Battleships theme: a Naumachia, the staged sea battle that Roman emperors held in a flooded arena.
 * The crowd watches from the arches of the amphitheatre under a red-and-cream awning (the velarium),
 * torches burn on the wall, and the sea is a mosaic of water tiles. Ships are triremes, the "guns"
 * are ballistae, bullets are lead sling stones, and the marks left on the tiles (splash, fire,
 * skull, mushroom cloud) are all drawn in code (components/NaumachiaArt.tsx), so they stay sharp
 * at any size.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../assets/images/battleships-bg.png')
 * It is used behind the whole screen (NaumachiaBackground). Draw the amphitheatre WITHOUT the grid:
 * the mosaic sea is part of the game screen. While it is null, a built-in placeholder (awning,
 * arches, torches, water) is drawn.
 *
 * FONTS: system serif fonts for now (Palatino on iPhone). To use Cinzel (Roman capitals), install
 * @expo-google-fonts/cinzel, load it with useFonts() in App.tsx, then set FONT_DISPLAY to
 * 'Cinzel_700Bold'. Nothing else needs to change.
 */
export const NAUMACHIA_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_DISPLAY = Platform.select({
  ios: 'Palatino-Bold',
  android: 'serif',
  default: 'Palatino, "Book Antiqua", Georgia, serif',
}) as string;
export const displayWeight = '700' as const;

export const roma = {
  // the amphitheatre
  stone: '#C9B38A',
  stoneDark: '#9C8660',
  arch: '#3A2A1A',
  velaRed: '#A62B24',
  velaCream: '#EFE3C2',

  // the sea
  water: ['#2F8C92', '#2A7F86', '#226F78', '#1B5F69'],
  tile: '#2A7F86',
  tileEdge: '#6CC3C3',
  grout: '#175E69',
  foam: '#E8F4F2',

  // wood, bronze, gold
  wood: '#8A5A2B',
  woodLight: '#B57F45',
  woodDark: '#5C3A1B',
  bronze: '#9A6B2F',
  gold: '#E6B94A',
  lead: '#8C8F99',
  leadDark: '#5B5E68',

  // marks
  bone: '#EFE6CF',
  boneShade: '#BFB18F',
  fire: '#E9A24B',
  fireDark: '#D9532B',
  fireLight: '#F6C56B',

  // text and plates
  ink: '#2B1D12',
  parchment: '#EAD9B0',
  parchmentEdge: '#B89A62',
  plaque: 'rgba(43,29,18,0.92)',
  plaqueEdge: '#6B4A22',
  cream: '#F2E8CF',
  blood: '#9E2A22',

  // one colour per player (the "dyes"): the badge on a shot tile, and the stripe on a player's plaque
  players: ['#E6B94A', '#D8553F', '#9A63C9', '#EC8F3A', '#F2E8CF', '#7FC8A9', '#E57BA6', '#9AA7B8'],
} as const;
