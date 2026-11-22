import { Platform } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

/**
 * Schulte Table theme: a children's home on a bright morning. Sunlight falls across a striped wall,
 * paper bunting hangs from the ceiling, and the numbers are wooden toy blocks sitting in a tray
 * lined with teal felt. Everything is soft and rounded: the mood is hope, not pressure.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../../assets/images/schulte-bg.png')
 * It is used behind the whole screen (OrphanageBackground). Draw the room WITHOUT the board: the
 * wooden tray and the blocks are part of the game screen. While it is null, a built-in placeholder
 * (striped wall, bunting, sun rays, wooden floor) is drawn.
 *
 * FONTS: system fonts for now (Chalkboard SE on iPhone, Casual on Android). To use Fredoka, install
 * @expo-google-fonts/fredoka, load it with useFonts() in App.tsx, then set FONT_DISPLAY to
 * 'Fredoka_600SemiBold'. Nothing else needs to change.
 */
export const KIDS_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_DISPLAY = Platform.select({
  ios: 'Chalkboard SE',
  android: 'casual',
  default: '"Chalkboard SE", "Comic Sans MS", cursive',
}) as string;
export const displayWeight = '700' as const;

export const kids = {
  // the room
  wall: '#FFF1D6',
  wallStripe: '#FCE6BF',
  wainscot: '#BFE3F2',
  rail: '#FFFDF6',
  floor: '#D9A66B',
  floorLine: '#B9854F',
  ray: 'rgba(255,243,190,0.30)', // the sunlight through the window

  // the toy blocks: `face` is the top, `base` the shaded edge underneath
  blocks: [
    { face: '#F4A092', base: '#C9705F' }, // coral
    { face: '#F7D56B', base: '#C9A23A' }, // butter
    { face: '#A5DDBB', base: '#6FAE8A' }, // mint
    { face: '#9ACFEF', base: '#5E9BC4' }, // sky
    { face: '#CDB6EE', base: '#9479C4' }, // lilac
    { face: '#F8BE93', base: '#C98B5C' }, // peach
  ],
  ink: '#4A3426', // numbers and text
  inkSoft: '#7A6350',

  // the tray
  frame: '#E2B07A',
  frameLight: '#F0C99A',
  frameBase: '#B9854F',
  mat: '#6DBFB0',
  matStitch: '#FFF3D6',

  // paper cut-outs (the clock, the rules)
  paper: '#FFFBF0',
  paperEdge: '#8CC7EA',
  tape: 'rgba(255,214,102,0.85)',
  title: '#D2584A',

  wrong: '#E8604C',
  wrongBase: '#B33D2D',
} as const;
