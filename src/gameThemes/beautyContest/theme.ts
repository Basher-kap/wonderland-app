import type { ImageSourcePropType } from 'react-native';

/**
 * Beauty Contest theme: The Royal Court, Judgment of Numbers. A vast black-marble courtroom of
 * gothic pillars and pointed arches, lined with metallic gold, lit by one spotlight on the central
 * judgment throne, and wired with cold holographic displays. Gold is power (the court, the
 * contestants), cyan is the machine (the holograms, the numbers), crimson is the verdict.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../../assets/images/beauty-contest-bg.png')
 * While it is null, RoyalCourtBackground draws the built-in placeholder courtroom.
 *
 * FONT: system font for now. Set FONT_ROYAL (for example after loading a font with useFonts) and
 * the game screen and the rules dialogs follow.
 */
export const ROYAL_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_ROYAL: string | undefined = undefined; // undefined = the system font

export const royal = {
  // black marble, top to bottom
  marble1: '#050507',
  marble2: '#09090D',
  marble3: '#0E0E14',
  marble4: '#13131B',
  marble5: '#0A0A0F',
  vein: '#2A2A38',

  panel: '#0D0D13', // contestant plates and panels
  plate: '#15151F', // a contestant's plate
  plateHi: '#1F1F2C',
  tablet: '#101018', // the rules dialogs

  gold: '#D9B24A',
  goldBright: '#F6DA7E',
  goldDeep: '#8A6A1E',

  holo: '#4FE3FF', // holograms and numbers
  holoDeep: '#1C6F85',
  holoGlow: 'rgba(79,227,255,0.14)',

  crimson: '#C0283F', // losing, GAME OVER
  crimsonSoft: '#FF6B80',
  win: '#7DF3B0', // winning the round

  bone: '#EFE9D8', // main text
  boneMuted: '#9A94A8', // quiet text
  hot: '#FF6B80', // the last seconds
} as const;
