import { Platform } from 'react-native';

/**
 * Pleasure theme: a lively Japanese variety-show quiz. A colourful TV studio (violet set, pink and
 * cyan stage lights, blinking LED strips, red curtains), big outlined "telop" captions, comic
 * onomatopoeia that pop on screen (PIN-PON!, BUBU-!, DON!) and a cheerful bear host.
 * Everything is drawn in code, so it stays sharp on any screen.
 *
 * FONT: heavy system fonts for the telop look. Set FONT_SHOW after loading a font with useFonts()
 * and the whole game follows.
 */
export const FONT_SHOW = Platform.select({
  ios: 'AvenirNext-Heavy',
  android: 'sans-serif-black',
  default: '"Arial Black", Impact, sans-serif',
}) as string;

export const show = {
  night: '#1E0B4B', // the set
  night2: '#2E1275',
  screen: '#120744', // the big TV screens
  screenEdge: '#FF3D81',
  ink: '#1B0B3F', // outlines
  white: '#FFFFFF',
  cream: '#FFF6DC',
  pink: '#FF3D81',
  yellow: '#FFD93B',
  cyan: '#29D3FF',
  lime: '#7CFF4F',
  orange: '#FF8A2B',
  purple: '#8B5CFF',
  red: '#FF3B3B',
  curtain: '#C2185B',
  curtainDark: '#8E0F44',
  muted: '#BDB0F0',
  good: '#4DFF9E',
  bad: '#FF6B6B',
} as const;

// The four choices: A, B, C, D (each with its own studio colour).
export const CHOICE_COLORS = [show.pink, show.cyan, show.yellow, show.lime] as const;
export const CHOICE_LETTERS = ['A', 'B', 'C', 'D'] as const;

// The sound-effect captions that pop on screen (and sound, where the platform can: see sfx.ts).
export const SFX_CAPTIONS = {
  pop: { text: 'POP!', color: show.yellow },
  quiz: { text: 'PIKON!', color: show.cyan },
  drum: { text: 'DORURURU…', color: show.orange },
  fanfare: { text: 'DON!!', color: show.pink },
  pinpon: { text: 'PIN-PON!', color: show.good },
  bubu: { text: 'BUBU-!', color: show.bad },
  win: { text: 'JAJAAN!', color: show.yellow },
} as const;
export type SfxName = keyof typeof SFX_CAPTIONS;
