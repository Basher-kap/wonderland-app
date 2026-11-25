import type { ImageSourcePropType } from 'react-native';

/**
 * Piano Tiles theme: The Midnight Recital. A black-lacquer concert stage in an empty hall, one
 * warm spotlight, ivory and ebony keys. A placeholder look until you send your own design.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../../assets/images/piano-tiles-bg.png')
 * While it is null, RecitalBackground draws the built-in placeholder stage.
 *
 * FONT: system font for now. Set FONT_PIANO (for example after loading a font with useFonts) and the
 * game screen and the rules dialogs follow.
 */
export const PIANO_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_PIANO: string | undefined = undefined; // undefined = the system font

export const stage = {
  // black lacquer, top to bottom
  black1: '#050508',
  black2: '#09090E',
  black3: '#0E0E15',
  black4: '#14141D',
  black5: '#0A0A10',
  sheen: '#2A2A38',

  panel: '#0F0F16',
  tablet: '#12121A',

  ivory: '#F4F1E8', // a white key, main text
  ivoryDeep: '#D8D3C2',
  ebony: '#0B0B10', // a black key
  ebonyEdge: '#34343F',

  gold: '#E2B84F', // the spotlight, what is lit
  goldBright: '#FFE08A',
  goldDeep: '#8A6A1E',
  goldWash: '#4A3A10', // a lit black key

  good: '#7DF3B0',
  bad: '#FF6B80',
  muted: '#9A94A8',
} as const;
