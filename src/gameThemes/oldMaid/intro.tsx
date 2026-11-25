import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { IntroTheme } from '../types';
import { FONT_DISPLAY, plaza as p } from './theme';
import { PlazaBackground } from './PlazaBackground';

// Old Maid: the rules are a cream card with a terracotta and gold frame and a tile-pattern edge.
function TileEdge() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={z.inner} />
      <View style={z.dotsTop}>
        {Array.from({ length: 9 }, (_, i) => (
          <View key={i} style={[z.dot, { backgroundColor: i % 2 ? p.tileBlue : p.tileYellow }]} />
        ))}
      </View>
    </View>
  );
}

const z = StyleSheet.create({
  inner: { position: 'absolute', top: 6, left: 6, right: 6, bottom: 6, borderWidth: 1.5, borderColor: p.terracotta, borderRadius: 10, opacity: 0.55 },
  dotsTop: { position: 'absolute', top: -7, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 14, height: 14, borderRadius: 3, transform: [{ rotate: '45deg' }], borderWidth: 1.5, borderColor: p.paper },
});

export const intro: IntroTheme = {
  Backdrop: PlazaBackground,
  accent: p.title,
  text: p.ink,
  hint: p.inkSoft,
  bullet: p.terracotta,
  fontFamily: FONT_DISPLAY,
  dialog: { backgroundColor: p.paper, borderColor: p.gold, borderWidth: 3, borderRadius: 14 },
  Decor: TileEdge,
};
