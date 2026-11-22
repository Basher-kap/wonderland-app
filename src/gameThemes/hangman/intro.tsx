import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { IntroTheme } from '../types';
import { FONT_DISPLAY, west as h } from './theme';
import { WildWestBackground } from './WildWestBackground';

// Hangman: the rules are a poster nailed to a board, a nail in every corner.
function PosterNails() {
  return (
    <View pointerEvents="none" style={nails.wrap}>
      <View style={[nails.nail, { top: 6, left: 6 }]} />
      <View style={[nails.nail, { top: 6, right: 6 }]} />
      <View style={[nails.nail, { bottom: 6, left: 6 }]} />
      <View style={[nails.nail, { bottom: 6, right: 6 }]} />
    </View>
  );
}

const nails = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill },
  nail: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: h.brassDark },
});

export const intro: IntroTheme = {
  Backdrop: WildWestBackground,
  accent: h.wanted,
  text: h.paperInk,
  hint: h.cream,
  bullet: h.wanted,
  fontFamily: FONT_DISPLAY,
  dialog: { backgroundColor: h.paper, borderColor: h.woodDark, borderWidth: 4, borderRadius: 4 },
  Decor: PosterNails,
};
