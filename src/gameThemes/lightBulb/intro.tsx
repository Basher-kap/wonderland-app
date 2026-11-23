import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { IntroTheme } from '../types';
import { FONT_DISPLAY, ruins as r } from './theme';
import { RuinsBackground } from './RuinsBackground';

// Light Bulb: the rules are a scorched page torn from a ledger, pinned to the wall with a strip of
// old tape, a brown water stain in one corner and a burnt edge along the bottom.
function ScorchedPage() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={s.tape} />
      <View style={s.stain} />
      <View style={s.burnt} />
    </View>
  );
}

const s = StyleSheet.create({
  tape: { position: 'absolute', top: -11, alignSelf: 'center', width: 84, height: 22, backgroundColor: r.tape, transform: [{ rotate: '2deg' }] },
  stain: { position: 'absolute', top: 14, right: 12, width: 54, height: 40, borderRadius: 27, backgroundColor: r.stain },
  burnt: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 7, backgroundColor: r.ink, opacity: 0.55, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
});

export const intro: IntroTheme = {
  Backdrop: RuinsBackground,
  accent: r.title,
  text: r.ink,
  hint: r.inkSoft,
  bullet: r.title,
  fontFamily: FONT_DISPLAY,
  dialog: { backgroundColor: r.paper, borderColor: r.ink, borderWidth: 2, borderRadius: 3 },
  Decor: ScorchedPage,
};
