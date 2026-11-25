import type { ImageSourcePropType } from 'react-native';

/**
 * Piano Tiles theme: the Enchanted Symphony. A magical concert hall of deep blue night, violet
 * light and gold: glowing chandeliers hang from the vault, notes drift upward through the air, and
 * the tiles are luminous musical keys. Pearl keys and midnight keys alternate, with a violet or gold
 * edge so every key stays clear against the dark and easy to hit.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../../assets/images/piano-tiles-bg.png')
 * While it is null, SymphonyBackground draws the built-in placeholder hall.
 *
 * FONT: system font for now. Set FONT_PIANO (for example after loading a font with useFonts) and the
 * game screen and the rules dialogs follow.
 */
export const PIANO_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_PIANO: string | undefined = undefined; // undefined = the system font

export const stage = {
  // the night of the hall, top to bottom
  black1: '#040719',
  black2: '#070C2A',
  black3: '#0B1340',
  black4: '#111A55',
  black5: '#07102F',
  sheen: '#2B3A8C', // quiet bars and unlit dots

  panel: '#0B1138', // player tags and panels
  tablet: '#0E1646', // the rules dialogs

  ivory: '#F4F0FF', // a pearl key, main text
  ivoryDeep: '#B9AEEA', // the edge of a pearl key
  ebony: '#0A1033', // a midnight key
  ebonyEdge: '#7B5CE6', // the violet edge that keeps a midnight key visible

  gold: '#F2C75C', // what is lit
  goldBright: '#FFE9A3',
  goldDeep: '#9A7424',
  goldWash: '#4B3A86', // a lit midnight key

  violet: '#7B52F0',
  violetSoft: '#B79CFF',
  blue: '#2F6BFF',

  good: '#7DF3C8',
  bad: '#FF6F91',
  muted: '#A9B1E6',
} as const;