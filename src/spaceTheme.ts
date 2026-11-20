import type { ImageSourcePropType } from 'react-native';
import { colors } from './theme';

/**
 * Space theme for Home, Leaderboard, Settings and Lobby.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../assets/images/space-bg.png')
 * While it is null, SpaceBackground draws a built-in placeholder (deep space, nebulae, planet, stars).
 */
export const SPACE_BG_IMAGE: ImageSourcePropType | null = null;

export const space = {
  // placeholder background layers (used only while SPACE_BG_IMAGE is null)
  bgDeep: colors.bg,
  bgMid: '#1F1B55',
  bgGlowA: '#6D4AE0', // violet nebula
  bgGlowB: '#1F6FA8', // blue nebula
  bgGlowC: '#C2478F', // pink dust
  star: '#FFFFFF',
  starWarm: '#FFE3B0',
  planet: '#6A55D6',
  planetRing: 'rgba(239, 159, 39, 0.5)', // colors.accent, see-through

  // dark layer over YOUR image so text stays readable (0 = none, 1 = black)
  imageDim: 0.35,

  // panels that sit on top of the background: same purples as theme.ts, a little see-through.
  // Kept at 0.82+ so muted text stays above 4.5:1 whatever the image behind is.
  card: 'rgba(38, 33, 92, 0.84)', // colors.card
  cardAlt: 'rgba(47, 42, 110, 0.88)', // colors.cardAlt
  input: 'rgba(23, 20, 58, 0.82)', // colors.bg
  border: 'rgba(130, 120, 230, 0.5)',
  borderTop: 'rgba(210, 200, 255, 0.4)', // lighter top edge = "light from above" glass look

  // glass panel: spread it in a style (`...space.glass`); put your own borderColor after it if needed
  glass: {
    backgroundColor: 'rgba(38, 33, 92, 0.84)',
    borderColor: 'rgba(130, 120, 230, 0.5)',
    borderTopColor: 'rgba(210, 200, 255, 0.4)',
  },

  // glow behind key text (lobby ID, screen titles)
  glowText: {
    textShadowColor: 'rgba(239, 159, 39, 0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
} as const;