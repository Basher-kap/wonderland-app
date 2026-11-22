import type { ImageSourcePropType, TextStyle, ViewStyle } from 'react-native';
import { colors } from './base';

/**
 * The Space look of the main pages (Home, Leaderboard, Settings, Lobby) and of the parts around them:
 * tab bar, chat, tickets, buttons with tone="space", and the lobby mic.
 *
 * Games never import this file. Each game has its own look in src/gameThemes/.
 *
 * BACKGROUND IMAGE: to show your own picture instead of the drawn sky, put it in assets/images/ and replace
 * `null` below with  require('../../assets/images/space-bg.png').
 */
export const SPACE_BG_IMAGE: ImageSourcePropType | null = null;

export const space = {
  void: '#000000',
  imageDim: 0.35, // dark layer over your own image, 0 = none, 1 = black

  // text, all above 4.5:1 on black
  text: '#EEF2FF',
  textDim: '#A3ACC8',
  textFaint: '#7C86A6',

  // glass: near-black, see-through, with a hairline. The top edge is a little brighter, like rim light.
  panelBg: 'rgba(5, 7, 14, 0.82)',
  fieldBg: 'rgba(255, 255, 255, 0.05)',
  pressedBg: 'rgba(255, 255, 255, 0.08)',
  line: 'rgba(196, 210, 255, 0.16)',
  lineStrong: 'rgba(196, 210, 255, 0.3)',
  rim: 'rgba(226, 234, 255, 0.34)',

  // amber is the one warm star: actions and tickets only
  amber: colors.accent,
  amberLine: 'rgba(239, 159, 39, 0.55)',
  amberWash: 'rgba(239, 159, 39, 0.12)',

  // ice is for "you" and for information
  ice: '#8FB8FF',
  iceLine: 'rgba(143, 184, 255, 0.38)',
  iceWash: 'rgba(143, 184, 255, 0.14)',

  danger: colors.danger,
} as const;

// A box on the sky.
export const panel: ViewStyle = {
  backgroundColor: space.panelBg,
  borderWidth: 1,
  borderColor: space.line,
  borderTopColor: space.rim,
  borderRadius: 20,
};

// One box that holds a list; the rows inside are separated by hairlines, not by more boxes.
export const listPanel: ViewStyle = { ...panel, borderRadius: 18, overflow: 'hidden' };

// The divider between two rows of a listPanel.
export const rowDivider: ViewStyle = { borderBottomWidth: 1, borderBottomColor: space.line };

// A text box.
export const field: ViewStyle & TextStyle = {
  backgroundColor: space.fieldBg,
  borderWidth: 1,
  borderColor: space.line,
  borderRadius: 14,
  color: space.text,
};

export const typo = {
  title: { color: space.text, fontSize: 26, fontWeight: '600', letterSpacing: 0.2 } as TextStyle,
  heading: { color: space.text, fontSize: 18, fontWeight: '600', letterSpacing: 0.15 } as TextStyle,
  body: { color: space.text, fontSize: 16 } as TextStyle,
  caption: { color: space.textDim, fontSize: 13, lineHeight: 18 } as TextStyle,
};