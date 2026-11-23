import type { ImageSourcePropType } from 'react-native';

/**
 * Future Sugoroku theme: the Ancient Cosmic Labyrinth, The Lost Dimension. Stone chambers floating
 * in a star-filled void, numbered doorways that glow when the die opens them, and a celestial
 * portal as the way out. Deep indigo for the void, dusk-violet stone, star-gold for what is
 * yours, portal-cyan for what is open.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../../assets/images/sugoroku-bg.png')
 * While it is null, CosmosBackground draws the built-in placeholder cosmos.
 *
 * FONT: system font for now. Set FONT_SUGOROKU (for example after loading a font with useFonts)
 * and the game screen and the rules dialogs follow.
 */
export const SUGOROKU_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_SUGOROKU: string | undefined = undefined; // undefined = the system font

export const cosmos = {
  // the void, top to bottom
  void1: '#04020D',
  void2: '#07041A',
  void3: '#0B0624',
  void4: '#10092F',
  void5: '#160D3B',

  nebulaViolet: '#7B4DFF',
  nebulaCyan: '#36D6E7',

  stone: '#2A2450', // a chamber
  stoneHi: '#4E4688', // the lit edge of a chamber
  stoneLo: '#15112E', // the shadowed edge
  stoneEdge: '#3A3270',
  panel: '#130E33', // player tags and panels
  tablet: '#1A1442', // the rules dialogs
  fog: '#0A0722', // a chamber nobody has seen yet

  star: '#F7E7A8',
  gold: '#F4C95D', // yours: your marker, your points
  goldSoft: '#FFE9A6',
  portal: '#7DF3E4', // open: the doorways the die opens, the portal
  portalViolet: '#B58CFF',

  bone: '#ECE8FF', // main text
  boneMuted: '#A59DD3', // quiet text
  rune: '#6D63B5', // carved runes, closed doorways

  bonus: '#F4C95D',
  danger: '#E0587A',
  recovery: '#6BE3A4',
  locked: '#E5A84F',
  illusion: '#C792EA',
  hot: '#FF7A90', // the last seconds
} as const;
