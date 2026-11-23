import { Platform } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

/**
 * Memory Card theme: a séance chamber at night. Heavy oxblood velvet drapes, damask wallpaper gone dark,
 * a moon in a tall window, and in the middle a round table under an indigo cloth, with a faint circle
 * of runes worked into it. The only light is candles (they flicker), so everything is warm gold on near
 * black. The cards are tarot-style: the backs show a gold eye under a crescent moon, the fronts show
 * the three icons (brain, earth, dice) on aged parchment, lit by a faint spirit-teal glow once matched.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../../assets/images/memory-card-bg.png')
 * It is used behind the whole screen (SeanceBackground). Draw the room WITHOUT the cards: the cards,
 * the clock and the candles on the table are part of the game screen. While it is null, a built-in
 * placeholder (drapes, moon window, round table) is drawn.
 *
 * FONTS: system serif for now (Palatino on iPhone, serif on Android). To use a display serif later
 * (e.g. Cinzel from @expo-google-fonts/cinzel), load it with useFonts() in App.tsx and set FONT_DISPLAY
 * to its name. Nothing else needs to change.
 */
export const SEANCE_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_DISPLAY = Platform.select({
  ios: 'Palatino',
  android: 'serif',
  default: '"Cinzel", Georgia, serif',
}) as string;
export const displayWeight = '700' as const;

export const seance = {
  // the room
  wall: '#17101A',
  wallDamask: '#241A29',
  velvet: '#3B1020',
  velvetDark: '#240915',
  velvetLight: '#52182D',
  tassel: '#B58B3C',
  moon: '#D8DCE6',
  moonGlow: 'rgba(190,200,230,0.10)',
  clothDark: '#1D1530',
  cloth: '#2A2045',
  lace: '#BDB19B',
  rune: '#8F7236',
  floor: '#0E0A0F',

  // the candles
  flame: '#FFB347',
  flameCore: '#FFF1C2',
  glow: 'rgba(255,170,70,0.20)',
  wax: '#E6D9BC',
  waxShade: '#BBA985',
  brass: '#9A7A33',

  // the cards
  backBase: '#2B1230',
  backEdge: '#C9A24B',
  backInk: '#8A6D2F',
  frontBase: '#D9C9A3',
  frontEdge: '#8A6D2F',
  matchedGlow: '#6FD6C8',
  missTint: '#B04A4A',
  iconBrain: '#A8456F',
  iconEarth: '#2F7F78',
  iconDice: '#8A6212',

  // paper and ink (the rules, the tags)
  paper: '#D9C9A3',
  ink: '#2A1B14',
  inkSoft: '#5E4B35',
  title: '#7A1F34', // dried wax red
  gold: '#C9A24B',
  goldDim: '#8A6D2F',

  text: '#EADFC4',
  textDim: '#A89A7C',
  warn: '#E0553B',
} as const;
