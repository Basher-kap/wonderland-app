// Per-game designs live in one folder each (theme.ts, background, art, intro.tsx). Games import
// their own folder directly (e.g. '../gameThemes/schulte'); the shell asks for a look by game id here.
export { GAME_LOOKS, getGameBackdrop, getIntroTheme } from './registry';
export type { GameLook, IntroTheme, Wrap } from './types';
