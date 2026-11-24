import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { IntroTheme } from '../types';
import { FONT_SHOW, show } from './theme';
import { StudioBackground } from './StudioBackground';

// Pleasure: the rules are a bright "telop" card, with a pink star in each top corner.
function StarDecor() {
  return (
    <>
      <View pointerEvents="none" style={s.left}>
        <Text style={s.glyph}>★</Text>
      </View>
      <View pointerEvents="none" style={s.right}>
        <Text style={s.glyph}>★</Text>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  left: { position: 'absolute', top: 6, left: 12 },
  right: { position: 'absolute', top: 6, right: 12 },
  glyph: { color: show.pink, fontSize: 20 },
});

export const intro: IntroTheme = {
  Backdrop: StudioBackground,
  accent: show.pink,
  text: show.ink,
  hint: show.muted,
  bullet: show.pink,
  fontFamily: FONT_SHOW,
  dialog: { backgroundColor: show.cream, borderColor: show.pink, borderWidth: 4, borderRadius: 18, paddingTop: 34 },
  Decor: StarDecor,
};
