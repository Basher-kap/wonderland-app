import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { IntroTheme } from '../types';
import { cave as cv, FONT_XIBALBA } from './theme';
import { CaveBackground } from './CaveBackground';
import { MayaGlyph } from './MayaGlyph';

// Traps of Xibalba: the rules are a stone tablet, with a carved glyph in each top corner.
function GlyphDecor() {
  return (
    <>
      <View pointerEvents="none" style={glyphs.left}>
        <MayaGlyph kind="face" size={24} color={cv.jadeDim} />
      </View>
      <View pointerEvents="none" style={glyphs.right}>
        <MayaGlyph kind="sun" size={24} color={cv.jadeDim} />
      </View>
    </>
  );
}

const glyphs = StyleSheet.create({
  left: { position: 'absolute', top: 10, left: 12 },
  right: { position: 'absolute', top: 10, right: 12 },
});

export const intro: IntroTheme = {
  Backdrop: CaveBackground,
  accent: cv.jade,
  text: cv.bone,
  hint: cv.boneMuted,
  bullet: cv.torch,
  fontFamily: FONT_XIBALBA,
  dialog: { backgroundColor: cv.tablet, borderColor: cv.stoneEdge, borderWidth: 4, borderRadius: 6, paddingTop: 40 },
  Decor: GlyphDecor,
};
