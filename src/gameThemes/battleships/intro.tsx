import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { IntroTheme } from '../types';
import { FONT_DISPLAY as FONT_ROMA, roma as ro } from './theme';
import { NaumachiaBackground } from './NaumachiaBackground';

// Battleships: the rules are a parchment, with a Greek key border along its bottom edge.
function GreekKey() {
  return (
    <View pointerEvents="none" style={key.row}>
      {Array.from({ length: 16 }, (_, i) => (
        <View key={i} style={[key.cell, i % 2 ? { transform: [{ rotate: '180deg' }] } : null]} />
      ))}
    </View>
  );
}

const key = StyleSheet.create({
  row: { position: 'absolute', left: 14, right: 14, bottom: 7, flexDirection: 'row', justifyContent: 'space-between' },
  cell: { width: 9, height: 9, borderTopWidth: 2, borderLeftWidth: 2, borderColor: ro.bronze },
});

export const intro: IntroTheme = {
  Backdrop: NaumachiaBackground,
  accent: ro.blood,
  text: ro.ink,
  hint: ro.cream,
  bullet: ro.bronze,
  fontFamily: FONT_ROMA,
  dialog: { backgroundColor: ro.parchment, borderColor: ro.bronze, borderWidth: 3, borderRadius: 6, paddingBottom: 30 },
  Decor: GreekKey,
};
