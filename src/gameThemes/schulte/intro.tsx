import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { IntroTheme } from '../types';
import { FONT_DISPLAY as FONT_KIDS, kids as k } from './theme';
import { OrphanageBackground } from './OrphanageBackground';

// Schulte Table: the rules are a paper note stuck on the wall with a strip of tape.
function TapeDecor() {
  return <View pointerEvents="none" style={tape.strip} />;
}

const tape = StyleSheet.create({
  strip: { position: 'absolute', top: -11, alignSelf: 'center', width: 84, height: 22, backgroundColor: k.tape, transform: [{ rotate: '-3deg' }] },
});

export const intro: IntroTheme = {
  Backdrop: OrphanageBackground,
  accent: k.title,
  text: k.ink,
  hint: k.inkSoft,
  bullet: k.title,
  fontFamily: FONT_KIDS,
  dialog: { backgroundColor: k.paper, borderColor: k.paperEdge, borderWidth: 3, borderRadius: 22 },
  Decor: TapeDecor,
};
