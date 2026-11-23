import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { IntroTheme } from '../types';
import { FONT_DISPLAY, seance as s } from './theme';
import { SeanceBackground } from './SeanceBackground';

// Memory Card: the rules are a card of aged parchment with a gold double border, and a wax seal
// pressed into the top edge.
function WaxSeal() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={z.inner} />
      <View style={z.seal}>
        <View style={z.sealRing} />
      </View>
    </View>
  );
}

const z = StyleSheet.create({
  inner: { position: 'absolute', top: 5, left: 5, right: 5, bottom: 5, borderWidth: 1, borderColor: s.goldDim, borderRadius: 3 },
  seal: { position: 'absolute', top: -14, alignSelf: 'center', width: 30, height: 30, borderRadius: 15, backgroundColor: s.title, alignItems: 'center', justifyContent: 'center' },
  sealRing: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: 'rgba(255,220,200,0.45)' },
});

export const intro: IntroTheme = {
  Backdrop: SeanceBackground,
  accent: s.title,
  text: s.ink,
  hint: s.inkSoft,
  bullet: s.goldDim,
  fontFamily: FONT_DISPLAY,
  dialog: { backgroundColor: s.paper, borderColor: s.gold, borderWidth: 3, borderRadius: 6 },
  Decor: WaxSeal,
};
