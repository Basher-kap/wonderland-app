import type { ImageSourcePropType } from 'react-native';

/**
 * Food Land theme (Magical Banana): a mint-chocolate dusk. A donut moon over marshmallow clouds,
 * sprinkles for stars, and a frosted cake for the ground. It is dark on purpose so the existing
 * light text of GameScreen stays readable.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../assets/images/foodland-bg.png')
 * While it is null, FoodLandBackground draws the built-in placeholder scene.
 *
 * FONT: system font for now. Set FONT_FOOD (for example after loading a rounded font with
 * useFonts) and the game screen and the rules dialogs pick it up.
 */
export const FOODLAND_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_FOOD: string | undefined = undefined; // undefined = the system font

export const food = {
  // sky, top to horizon
  skyTop: '#0B2523',
  sky2: '#0E302C',
  skyMid: '#12403A',
  sky4: '#175047',
  skyLow: '#1C5A4C',
  skyEnd: '#1F6455',
  hillBack: '#14463C',
  hillFront: '#1B5A4A',

  cocoa: '#3B2218', // the cake, the stall, the dish in the middle
  cocoaLight: '#6B4A3A',
  frosting: '#F28AB2',
  berry: '#C0305E', // buttons and headings on cream
  custard: '#FFD66B',
  dough: '#E6AE6B', // the donut
  cream: '#FFF3DC', // cards and name tags
  creamEdge: '#E0CFAE',
  mint: '#43C9A8',
  ink: '#3B2218', // text on cream
  inkMuted: '#7A5646',
  textSoft: '#CFE8DF', // muted text on the dark sky
  sprinkles: ['#F28AB2', '#FFD66B', '#43C9A8', '#FFF3DC'],

  imageDim: 0.25,
} as const;
