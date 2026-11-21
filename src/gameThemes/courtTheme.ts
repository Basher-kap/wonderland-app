import { Platform } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

/**
 * Janken Negotiation theme: the Supreme Court, in session. A vast, cold, nearly empty hall in dark
 * sky blue: tall stone columns, the judges' high bench looming at the top with its scales, and one
 * pale shaft of light falling on the circle where the players stand. Heavy shadows at the edges.
 * Intimidating and gloomy on purpose.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../assets/images/court-bg.png')
 * Leave the middle dark and empty (the players' circle sits there). While it is null,
 * CourtBackground draws the built-in placeholder hall.
 *
 * FONT: a heavy serif for gravity. Change FONT_COURT here and the game screen and the rules dialogs
 * follow.
 */
export const COURT_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_COURT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }) as string;

export const court = {
  // the hall, top to bottom
  dark1: '#03070D',
  dark2: '#060E18',
  dark3: '#0A1727',
  dark4: '#0E2035',
  dark5: '#122A44',
  dark6: '#0B1B2E',
  floor: '#07111D',

  // the dark sky blue of the theme
  skyDeep: '#0D2236',
  skyDark: '#1B3F5E',
  skyMid: '#2F6A99',
  skyPale: '#9CCBEE', // the shaft of light, highlights, headings

  steel: '#8AA3B8', // the scales, the trim
  steelDim: '#4B6A86',
  stone: '#16283A', // columns
  stoneHi: '#27425B',
  stoneCap: '#1E3348',
  bench: '#0A1522',
  benchInlay: '#07101A',
  chair: '#08111B',

  panel: '#0F2238', // plates, buttons, dialogs
  panelEdge: '#2B4A66',
  text: '#DCE9F5',
  muted: '#8FA9C0',
  blood: '#C0504A', // the opponent
  bloodBright: '#E0645E',
} as const;
