import type React from 'react';
import type { ViewStyle } from 'react-native';

export type Wrap = React.ComponentType<{ children?: React.ReactNode }>;

// The look of the rules dialogs (RoundIntro). `accent` colours the title, the name and the headings.
export type IntroTheme = {
  Backdrop: Wrap;
  accent: string;
  text: string;
  hint: string;
  bullet: string;
  fontFamily?: string;
  dialog: ViewStyle;
  Awning?: React.ComponentType; // sits above the dialog, in the flow (the stall awning)
  Decor?: React.ComponentType; // drawn inside the dialog, absolutely positioned (the bookmark, the marquee)
};

// Everything a game needs to look like itself: the screen background and the rules-dialog theme.
export type GameLook = {
  Backdrop: Wrap;
  intro: IntroTheme;
};
