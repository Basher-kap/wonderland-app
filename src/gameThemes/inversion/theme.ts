import { Platform } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

/**
 * Inversion theme: the finals of an esports tournament. Stage lights sweep a dark arena, a crowd
 * waits in front of an LED floor, and you play on a game controller: the answer buttons are its
 * D-pad and its four face buttons.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../../assets/images/inversion-bg.png')
 * It is used behind the whole screen (EsportsArenaBackground). Draw the arena WITHOUT the monitor and
 * the controller: those are part of the game screen. While it is null, a built-in placeholder
 * (stage lights, light truss, LED floor, crowd) is drawn.
 *
 * FONTS: system fonts for now (Avenir Next Condensed on iPhone, condensed sans on Android). To use
 * Rajdhani, install @expo-google-fonts/rajdhani, load it with useFonts() in App.tsx, then set
 * FONT_DISPLAY to 'Rajdhani_700Bold'. Nothing else needs to change.
 */
export const ARENA_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_DISPLAY = Platform.select({
  ios: 'AvenirNextCondensed-Heavy',
  android: 'sans-serif-condensed',
  default: '"Arial Narrow", Impact, sans-serif',
}) as string;
export const displayWeight = '900' as const;

export const esp = {
  // the arena, from the lights down to the floor
  arena: ['#05060F', '#080A1C', '#0D0F2B', '#150F38'],
  truss: '#12142A',
  trussEdge: '#2A2F57',
  crowd: '#04050D',

  cyan: '#35E0FF', // arrows, active controls, the grid
  magenta: '#FF4FA3',
  violet: '#C77DFF',
  hot: '#FF2E63', // the INVERSED sign, mistakes
  lime: '#3DDC97', // correct
  amber: '#FFB02E',
  blue: '#4DA3FF',

  // the monitor in the middle
  bezel: '#12142A',
  bezelEdge: '#2A2F57',
  screen: '#071029',
  screenGrid: 'rgba(53,224,255,0.08)',

  // the controller
  body: '#1B1D2B',
  bodyLight: '#2B2E45',
  keyDark: '#0F1020',
  keyOff: '#202338',
  glyphOff: '#3A3F5C',

  text: '#EAF6FF',
  muted: '#8FA3D6',
  panel: '#0D1030', // dialogs
} as const;
