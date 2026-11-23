import { Platform } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

/**
 * Color Territory theme: Magical Kingdoms, the Enchanted Territory. A moonlit fantasy glade under a
 * violet night sky: far castles on the hills, drifting motes of light, and the white circles are
 * pearls of untouched magic. A kingdom's colour turns a pearl into a glowing orb with a rune on it.
 * Everything is drawn in code (EnchantedBackground.tsx, Orb.tsx), so it stays sharp at any size.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../../assets/images/color-territory-bg.png')
 * Draw the glade WITHOUT the orbs. While it is null, the built-in night sky is drawn.
 *
 * FONT: system serif fonts for now (Georgia on iPhone). Set FONT_DISPLAY after loading a font with
 * useFonts() and the game screen and the rules dialogs follow.
 */
export const TERRITORY_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_DISPLAY = Platform.select({
  ios: 'Georgia-Bold',
  android: 'serif',
  default: 'Georgia, "Palatino Linotype", serif',
}) as string;
export const displayWeight = '700' as const;

export const glade = {
  // the night sky, top to bottom
  sky1: '#0E0824',
  sky2: '#1A0F3D',
  sky3: '#2A1757',
  sky4: '#3B2070',
  sky5: '#2E3A7A', // the horizon glow
  hillFar: '#1C1650',
  hillNear: '#120E36',
  castle: '#241B5E',
  moon: '#FFF4D6',
  moonGlow: '#BFA8FF',

  gold: '#F2CB6B', // trim, timer, titles
  goldDeep: '#B9923A',
  parchment: '#F4E7C6', // the rules dialogs
  parchmentEdge: '#C9A55A',
  ink: '#2A1B4D',
  inkSoft: '#5B4586',

  panel: 'rgba(24, 14, 58, 0.78)', // scoreboard and board
  panelEdge: 'rgba(242, 203, 107, 0.55)',
  text: '#FBF3FF',
  textMuted: '#B9A8E6',

  pearl: '#F6F1FF', // a circle nobody owns
  pearlShade: '#CFC4EE',
  pearlGlow: '#DCD0FF',
  hot: '#FF8A7A', // the last seconds
} as const;

// A kingdom = a colour slot (game/territory.ts hands every player a different slot). Each has a rune
// so a circle never depends on colour alone. `glow` is the soft halo, `deep` the shaded rim.
export type Kingdom = { name: string; color: string; light: string; deep: string; rune: string };

export const KINGDOM_LIST: readonly Kingdom[] = [
  { name: 'Ember Dragons', color: '#F2384B', light: '#FF8D98', deep: '#9A1230', rune: '✹' },
  { name: 'Verdant Elves', color: '#2FD27F', light: '#9BF5C4', deep: '#0F7A48', rune: '✿' },
  { name: 'Tide Mermaids', color: '#3D8BFF', light: '#A9CFFF', deep: '#1A4DB5', rune: '☾' },
  { name: 'Dusk Wizards', color: '#A66CFF', light: '#D5B8FF', deep: '#5A2BB0', rune: '✦' },
  { name: 'Sun Griffins', color: '#FFD23D', light: '#FFF0A6', deep: '#B8860B', rune: '❂' },
  { name: 'Frost Sprites', color: '#35E0E6', light: '#A9F7F9', deep: '#0E8C96', rune: '❖' },
  { name: 'Rose Fae', color: '#FF6FBE', light: '#FFB9E0', deep: '#B02B7C', rune: '♦' },
  { name: 'Flame Phoenixes', color: '#FF7F2A', light: '#FFBE8A', deep: '#B04A08', rune: '✚' },
];

export const kingdomOf = (slot: number): Kingdom => KINGDOM_LIST[((slot % KINGDOM_LIST.length) + KINGDOM_LIST.length) % KINGDOM_LIST.length];
