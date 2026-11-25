import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { IntroTheme } from '../types';
import { stage as sc, FONT_PIANO } from './theme';
import { RecitalBackground } from './RecitalBackground';

// Piano Tiles: the rules sit on a black lacquer lid edged in gold, a note carved in each top corner.
function NoteDecor() {
  return (
    <>
      <View pointerEvents="none" style={notes.left}>
        <Text style={[notes.glyph, { color: sc.gold }]}>♪</Text>
      </View>
      <View pointerEvents="none" style={notes.right}>
        <Text style={[notes.glyph, { color: sc.ivory }]}>♫</Text>
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
  Backdrop: RecitalBackground,
  accent: sc.gold,
  text: sc.ivory,
  hint: sc.muted,
  bullet: sc.goldBright,
  fontFamily: FONT_PIANO,
  dialog: { backgroundColor: sc.tablet, borderColor: sc.gold, borderWidth: 3, borderRadius: 10, paddingTop: 42 },
  Decor: NoteDecor,
};
