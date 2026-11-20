import React from 'react';
import type { ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { FoodLandBackground } from '../components/FoodLandBackground';
import { food as f } from './foodLandTheme';

// One place that says which games have their own look. A game that is not listed here keeps the
// Space look. GameScreen and RoundIntro ask this file; nothing else has to know the list.

type Wrap = React.ComponentType<{ children?: React.ReactNode }>;

// The background of the whole game screen (GameScreen) and of the rules dialogs (RoundIntro).
export function getGameBackdrop(gameId?: string): Wrap | null {
  if (gameId === 'magical-banana') return FoodLandBackground;
  return null;
}

// The look of the rules dialogs (RoundIntro). `accent` colours the title, the name and the headings.
export type IntroTheme = {
  Backdrop: Wrap;
  accent: string;
  text: string;
  hint: string;
  bullet: string;
  fontFamily?: string;
  dialog: ViewStyle;
  Awning?: React.ComponentType;
};

// A food-stall awning: stripes with scalloped edges, hanging over the rules card.
function StallAwning() {
  return (
    <View style={awning.row} pointerEvents="none">
      {Array.from({ length: 9 }, (_, i) => (
        <View key={i} style={[awning.stripe, { backgroundColor: i % 2 ? f.cream : f.berry }]} />
      ))}
    </View>
  );
}

const awning = StyleSheet.create({
  row: { flexDirection: 'row', height: 28, zIndex: 2 },
  stripe: { flex: 1, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
});

const FOOD_INTRO: IntroTheme = {
  Backdrop: FoodLandBackground,
  accent: f.berry,
  text: f.ink,
  hint: f.textSoft,
  bullet: f.berry,
  dialog: { backgroundColor: f.cream, borderColor: f.creamEdge, borderWidth: 2, borderRadius: 18, marginTop: -14, paddingTop: 36 },
  Awning: StallAwning,
};

export function getIntroTheme(gameId?: string): IntroTheme | null {
  if (gameId === 'magical-banana') return FOOD_INTRO;
  return null;
}
