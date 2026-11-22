import { Platform } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

/**
 * Wordle theme: a reading room after hours (a dim library, one lamp lighting the desk).
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../../assets/images/wordle-bg.png')
 * While it is null, WordleGame draws a built-in placeholder (bookshelf wall + lamp glow).
 *
 * FONTS: system serif fonts for now (no extra package needed). To use Alegreya (text) and
 * Alfa Slab One (letters), install @expo-google-fonts/alegreya and @expo-google-fonts/alfa-slab-one,
 * load them with useFonts() in App.tsx, then set FONT_BODY / FONT_TILE to 'Alegreya_500Medium' /
 * 'AlfaSlabOne_400Regular'. Nothing else needs to change.
 */
export const WORDLE_BG_IMAGE: ImageSourcePropType | null = null;

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }) as string;
export const FONT_BODY = serif;
export const FONT_TILE = serif; // rendered bold, see `tileWeight`
export const tileWeight = '900' as const;

export const wordle = {
  walnut: '#241710', // the shelf wall behind everything
  walnutLight: '#3A2618', // shelf planks
  lampGlow: '#F2B84B',
  blotter: '#1E4A3D', // the green desk the board sits on
  blotterDeep: '#173A30',
  brass: '#C8963E',
  brassDark: '#8E6A28',
  page: '#E6D8B4', // tile and key faces
  pageEdge: '#B9A982',
  ink: '#2A2118', // letters on pages
  paperText: '#F3E9CF', // light text on the dark scene
  paperMuted: '#C9B896',
  oxblood: '#7A2630',
  ribbon: '#B8323F', // the bookmark hanging off a correct tile
  badRow: '#B3303F',
  badFace: '#EBC9C6',

  // result colours (letter colour chosen for contrast on each)
  correct: { bg: '#2F7A47', text: '#FFF8E6' },
  present: { bg: '#C9A227', text: '#2A2118' },
  absent: { bg: '#4B4750', text: '#D9D2C3' },

  // spines for the placeholder bookshelf
  spines: ['#7A2630', '#2F5D50', '#B07A2A', '#3B4A7A', '#6B3F5E', '#8A5A2B', '#4A6B3A', '#9A3F2A'],
} as const;
