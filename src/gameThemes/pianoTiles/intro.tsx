import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { IntroTheme } from '../types';
import { stage as sc, FONT_PIANO } from './theme';
import { SymphonyBackground } from './SymphonyBackground';

// Piano Tiles: the rules glow on a deep blue tablet edged in gold, a note in each top corner.
function NoteDecor() {
  return (
    <>
      <View pointerEvents="none" style={notes.left}>
        <Text style={[notes.glyph, { color: sc.gold }]}>♪</Text>
      </View>
      <View pointerEvents="none" style={notes.right}>
        <Text style={[notes.glyph, { color: sc.violetSoft }]}>♫</Text>
      </View>
    </>
  );
}

const notes = StyleSheet.create({
  left: { position: 'absolute', top: 6, left: 14 },
  right: { position: 'absolute', top: 6, right: 14 },
  glyph: { fontSize: 24 },
});

export const intro: IntroTheme = {
  Backdrop: SymphonyBackground,
  accent: sc.gold,
  text: sc.ivory,
  hint: sc.muted,
  bullet: sc.violetSoft,
  fontFamily: FONT_PIANO,
  dialog: { backgroundColor: sc.tablet, borderColor: sc.gold, borderWidth: 3, borderRadius: 14, paddingTop: 42 },
  Decor: NoteDecor,
};