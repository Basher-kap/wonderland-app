import { Platform } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

/**
 * Human Calculator theme: a quiz-show stage with one big monitor.
 * The numbers appear on the monitor, the chances are lamps, the 5 seconds are a row of bulbs under
 * the screen, and the keypad sits on the contestant's podium.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../../assets/images/calculator-bg.png')
 * Draw the stage WITHOUT the monitor (the monitor is part of the game screen). While it is null,
 * HumanCalculatorGame draws a built-in placeholder (curtains, marquee bulbs and a spotlight).
 *
 * FONTS: system fonts for now. FONT_SCREEN is the monitor's digits, FONT_LABEL the small plates.
 * Change them here (for example after loading a font with useFonts) and nothing else needs to change.
 */
export const CALC_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_SCREEN = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'Menlo, monospace' }) as string;
export const FONT_LABEL = undefined; // undefined = the system font

export const calc = {
  stage: '#120F1F', // the dark studio behind everything
  curtain: '#5A1230',
  curtainFold: '#450E26',
  gold: '#E8B23A', // trim, marquee bulbs, the Send button
  goldDim: '#6E5620',
  bulbOff: '#3A3120',
  hot: '#FF5A4D', // the last bulbs of the timer

  bezel: '#15171F',
  bezelEdge: '#2B2F3D',
  screen: '#07162B',
  screenText: '#6BE3FF', // digits on the monitor
  screenMuted: '#8FB5CC',
  screenGlow: 'rgba(107,227,255,0.55)',

  podium: '#2A1D18',
  podiumTop: '#4A3228',
  key: '#2B2F42',
  keyEdge: '#161826',
  keyText: '#F2F6FF',

  board: '#1A1730', // scoreboard plates
  boardText: '#F2F6FF',
  boardMuted: '#B9B4D6',
  ok: '#3FD08A',
  bad: '#FF7A7A',
  spot: '#BFE9FF', // spotlight
} as const;
