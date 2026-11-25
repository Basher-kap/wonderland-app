import { Platform } from 'react-native';

/**
 * Russian Roulette theme: a secret underground Black Market gambling den. Dim industrial lamps swinging
 * over a brick wall, smoke drifting through the air, a worn wooden table with metal studs and the dark
 * silhouettes of the other gamblers. Black, dark red and muted gold. The revolver's cylinder is the
 * hero of the screen (Cylinder.tsx). Everything is drawn in code, so it stays sharp at any size.
 *
 * FONT: condensed system fonts. Set FONT_DEN after loading a font with useFonts() and the whole
 * game follows.
 */
export const FONT_DEN = Platform.select({
  ios: 'Futura-CondensedExtraBold',
  android: 'sans-serif-condensed',
  default: 'Impact, "Arial Narrow", sans-serif',
}) as string;

export const den = {
  black: '#080506',
  soot: '#120C0B',
  wall: '#1B1210',
  mortar: '#0D0807',
  wood: '#3A2416',
  woodDark: '#24150C',
  woodLight: '#5A3A22',
  steel: '#4A4F57',
  steelDark: '#25282D',
  steelLight: '#8B919B',
  blood: '#8E1117',
  bloodDark: '#4A070B',
  bloodBright: '#D01D24',
  gold: '#B8964A',
  goldDim: '#7D6630',
  bone: '#E8DCC0',
  boneMuted: '#A89E86',
  brass: '#C9A24D',
  copper: '#B5602F',
  panel: 'rgba(12,8,7,0.82)',
} as const;

export const CHAMBER_COUNT = 6;
export const SILHOUETTES = 5; // different gambler shapes (Silhouette.tsx)
