import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { IntroTheme } from '../types';
import { royal as rc, FONT_ROYAL } from './theme';
import { RoyalCourtBackground } from './RoyalCourtBackground';

// Beauty Contest: the rules are read from a black-marble tablet edged in gold, a crown above each
// top corner.
function CrownDecor() {
  return (
    <>
      <View pointerEvents="none" style={crowns.left}>
        <Text style={[crowns.glyph, { color: rc.gold }]}>♛</Text>
      </View>
      <View pointerEvents="none" style={crowns.right}>
        <Text style={[crowns.glyph, { color: rc.holo }]}>♛</Text>
      </View>
    </>
  );
}

const crowns = StyleSheet.create({
  left: { position: 'absolute', top: 6, left: 14 },
  right: { position: 'absolute', top: 6, right: 14 },
  glyph: { fontSize: 24 },
});

export const intro: IntroTheme = {
  Backdrop: RoyalCourtBackground,
  accent: rc.gold,
  text: rc.bone,
  hint: rc.boneMuted,
  bullet: rc.holo,
  fontFamily: FONT_ROYAL,
  dialog: { backgroundColor: rc.tablet, borderColor: rc.gold, borderWidth: 3, borderRadius: 4, paddingTop: 42 },
  Decor: CrownDecor,
};
