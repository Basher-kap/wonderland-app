import { Platform } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

/**
 * Light Bulb theme: the ruins of an old family house after a war. The plaster has come off the walls
 * in sheets (brick and lath showing through), the floral wallpaper hangs in faded strips, a window
 * frame holds a few teeth of glass, and a pale ash-grey light falls across the rubble. Nothing is
 * bright except what matters: the one bulb (warm, hopeful) and the TNT (ember red). The mood is
 * quiet and tense, never gory: the dead are only ever implied (an empty picture frame, a stopped clock).
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../../assets/images/light-bulb-bg.png')
 * It is used behind the whole screen (RuinsBackground). Draw the room WITHOUT the board: the switches,
 * wires, bulb and TNT are part of the game screen. While it is null, a built-in placeholder
 * (striped wallpaper, torn plaster, broken window, rubble floor) is drawn.
 *
 * FONTS: system fonts for now (typewriter on iPhone, monospace on Android) so everything reads like a
 * wartime ledger. To use a stencil font later (e.g. Special Elite from @expo-google-fonts/special-elite),
 * load it with useFonts() in App.tsx and set FONT_DISPLAY to its name. Nothing else needs to change.
 */
export const RUINS_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_DISPLAY = Platform.select({
  ios: 'American Typewriter',
  android: 'monospace',
  default: '"Special Elite", "Courier New", monospace',
}) as string;
export const displayWeight = '700' as const;

export const ruins = {
  // the room
  wall: '#2A2521',
  wallStripe: '#332D27',
  wallpaperFlower: '#4A3A30',
  plaster: '#6A6258',
  plasterDark: '#4D463E',
  brick: '#6B3F31',
  brickDark: '#47281F',
  lath: '#3B2E22',
  soot: '#0F0D0B',
  ash: '#8E8981',
  light: 'rgba(214,220,226,0.14)', // the pale light through the broken window
  floor: '#1B1815',
  rubble: ['#4A443C', '#5B5349', '#3A342E', '#6B6155'],
  ember: '#C8642A',

  // the board
  panel: '#1D1916', // the fuse box the switches sit in
  panelEdge: '#4A433B',
  rivet: '#6E665B',
  wire: '#A7A29A', // EVERY wire is this grey
  wireShade: '#121010', // the dark edge under a wire, so you can tell which one crosses over
  switchPlate: '#3A342D',
  switchPlateLit: '#4F4437',
  lever: '#B9B1A3',
  leverArmed: '#E3A64A',
  bulbGlass: '#4B4943',
  bulbGlow: '#FFD27A',
  bulbGlowCore: '#FFF3C9',
  tnt: '#A4322A',
  tntDark: '#5E1B16',
  tntBand: '#D8CDB5',
  tntFuse: '#C8A85A',
  blast: '#FF8A3D',
  blastCore: '#FFE9B0',

  // paper and ink (the rules, the tags)
  paper: '#CDC2AB',
  paperDark: '#B3A78F',
  ink: '#241E19',
  inkSoft: '#5B5042',
  stain: 'rgba(87,64,38,0.30)',
  tape: 'rgba(214,196,150,0.75)',
  title: '#8E2F22', // faded blood-red stamp ink for headings

  text: '#E4DED2',
  textDim: '#A39C90',
  warn: '#E0553B',
} as const;
