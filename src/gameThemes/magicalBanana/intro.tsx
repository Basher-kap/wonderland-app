import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { IntroTheme } from '../types';
import { food as f } from './theme';
import { FoodLandBackground } from './FoodLandBackground';

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

export const intro: IntroTheme = {
  Backdrop: FoodLandBackground,
  accent: f.berry,
  text: f.ink,
  hint: f.textSoft,
  bullet: f.berry,
  dialog: { backgroundColor: f.cream, borderColor: f.creamEdge, borderWidth: 2, borderRadius: 18, marginTop: -14, paddingTop: 36 },
  Awning: StallAwning,
};
