import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { IntroTheme } from '../types';
import { cosmos as cs, FONT_SUGOROKU } from './theme';
import { CosmosBackground } from './CosmosBackground';

// Future Sugoroku: the rules are a stone tablet adrift in the void, a star carved in each top corner.
function StarDecor() {
  return (
    <>
      <View pointerEvents="none" style={stars.left}>
        <Text style={[stars.glyph, { color: cs.gold }]}>✦</Text>
      </View>
      <View pointerEvents="none" style={stars.right}>
        <Text style={[stars.glyph, { color: cs.portal }]}>✧</Text>
      </View>
    </>
  );
}

const stars = StyleSheet.create({
  left: { position: 'absolute', top: 8, left: 14 },
  right: { position: 'absolute', top: 8, right: 14 },
  glyph: { fontSize: 22 },
});

export const intro: IntroTheme = {
  Backdrop: CosmosBackground,
  accent: cs.gold,
  text: cs.bone,
  hint: cs.boneMuted,
  bullet: cs.portal,
  fontFamily: FONT_SUGOROKU,
  dialog: { backgroundColor: cs.tablet, borderColor: cs.stoneHi, borderWidth: 3, borderRadius: 12, paddingTop: 40 },
  Decor: StarDecor,
};
