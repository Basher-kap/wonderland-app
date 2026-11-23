import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { IntroTheme } from '../types';
import { FONT_DISPLAY, glade as g } from './theme';
import { EnchantedBackground } from './EnchantedBackground';

// Color Territory: the rules are an old parchment scroll, with a gold star in each top corner.
function StarDecor() {
  return (
    <>
      <View pointerEvents="none" style={stars.left}>
        <Text style={stars.glyph}>✦</Text>
      </View>
      <View pointerEvents="none" style={stars.right}>
        <Text style={stars.glyph}>✦</Text>
      </View>
    </>
  );
}

const stars = StyleSheet.create({
  left: { position: 'absolute', top: 8, left: 12 },
  right: { position: 'absolute', top: 8, right: 12 },
  glyph: { color: g.goldDeep, fontSize: 18 },
});

export const intro: IntroTheme = {
  Backdrop: EnchantedBackground,
  accent: g.goldDeep,
  text: g.ink,
  hint: g.textMuted,
  bullet: g.goldDeep,
  fontFamily: FONT_DISPLAY,
  dialog: { backgroundColor: g.parchment, borderColor: g.parchmentEdge, borderWidth: 3, borderRadius: 14, paddingTop: 34 },
  Decor: StarDecor,
};
