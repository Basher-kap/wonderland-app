import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { IntroTheme } from '../types';
import { calc as c, FONT_SCREEN } from './theme';
import { QuizStageBackground } from './QuizStageBackground';

// Human Calculator: the rules appear on the big monitor, under a row of marquee bulbs.
function MarqueeDecor() {
  return (
    <View pointerEvents="none" style={marquee.row}>
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} style={marquee.bulb} />
      ))}
    </View>
  );
}

const marquee = StyleSheet.create({
  row: { position: 'absolute', top: 10, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  bulb: { width: 7, height: 7, borderRadius: 7, backgroundColor: c.gold },
});

export const intro: IntroTheme = {
  Backdrop: QuizStageBackground,
  accent: c.screenText,
  text: c.keyText,
  hint: c.boardMuted,
  bullet: c.gold,
  fontFamily: FONT_SCREEN,
  dialog: { backgroundColor: c.screen, borderColor: c.bezelEdge, borderWidth: 6, borderRadius: 16, paddingTop: 38 },
  Decor: MarqueeDecor,
};
