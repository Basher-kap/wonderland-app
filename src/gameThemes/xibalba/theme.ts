import type { ImageSourcePropType } from 'react-native';

/**
 * Traps of Xibalba theme: the Maya underworld, deep inside a cave. It is dark on purpose: only the
 * row being stepped on is lit by torchlight, and the rows around it fade into the dark the further
 * they are. Stone slabs, carved glyphs, jade, torch fire, bone.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../../assets/images/xibalba-bg.png')
 * While it is null, CaveBackground draws the built-in placeholder cave.
 *
 * FONT: system font for now. Set FONT_XIBALBA (for example after loading a font with useFonts) and
 * the game screen and the rules dialogs follow.
 */
export const XIBALBA_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_XIBALBA: string | undefined = undefined; // undefined = the system font

export const cave = {
  // the dark, top to bottom
  dark1: '#040809',
  dark2: '#070E0F',
  dark3: '#0A1315',
  dark4: '#0C1719',
  dark5: '#0D1A1B',

  rockA: '#0E1718', // stalactites and the pyramid
  rockB: '#121D1E',
  rockEdge: '#1B2B2A',

  stone: '#222E2D', // a floor slab
  stoneHi: '#3C4E49', // the lit edge of a slab
  stoneLo: '#141C1B', // the shadowed edge
  stoneEdge: '#2E3C3A',
  panel: '#161F20', // player tags and panels
  floor: '#0B1112', // under the slabs
  tablet: '#1B2625', // the rules dialogs

  jade: '#4FE0B0',
  jadeDim: '#2FA883',
  jadeDeep: '#1E7A5C',
  torch: '#FF8A2A',
  torchSoft: '#FFC27A',

  bone: '#E6DCC3', // main text
  boneMuted: '#9BB5AE', // quiet text
  blood: '#7A2020',
  bloodBright: '#E0584A',
  hot: '#FF6A55', // the last seconds

  glyph: '#5E8A7C', // carved glyphs
} as const;
