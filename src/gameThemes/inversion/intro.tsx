import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { IntroTheme } from '../types';
import { FONT_DISPLAY as FONT_ESP, esp as e } from './theme';
import { EsportsArenaBackground } from './EsportsArenaBackground';

// Inversion: the rules appear on an arena screen, with a bracket in each corner.
function ScreenBrackets() {
  const arm = { position: 'absolute' as const, width: 16, height: 16, borderColor: e.cyan };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[arm, { top: 6, left: 6, borderTopWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[arm, { top: 6, right: 6, borderTopWidth: 2, borderRightWidth: 2 }]} />
      <View style={[arm, { bottom: 6, left: 6, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[arm, { bottom: 6, right: 6, borderBottomWidth: 2, borderRightWidth: 2 }]} />
    </View>
  );
}

export const intro: IntroTheme = {
  Backdrop: EsportsArenaBackground,
  accent: e.magenta,
  text: e.text,
  hint: e.muted,
  bullet: e.cyan,
  fontFamily: FONT_ESP,
  dialog: { backgroundColor: e.panel, borderColor: e.bezelEdge, borderWidth: 2, borderRadius: 8 },
  Decor: ScreenBrackets,
};
