import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { IntroTheme } from '../types';
import { FONT_FORTUNE, fortune as fo } from './theme';
import { FestivalBackground } from './FestivalBackground';

// Fortune: the rules are an omikuji slip, with a red hanko seal ("fortune") in the corner.
function HankoDecor() {
  return (
    <View pointerEvents="none" style={hanko.seal}>
      <Text style={hanko.mark}>福</Text>
    </View>
  );
}

const hanko = StyleSheet.create({
  seal: { position: 'absolute', top: 12, right: 14, width: 38, height: 38, borderRadius: 6, backgroundColor: fo.vermilion, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
  mark: { color: fo.paper, fontSize: 24, fontWeight: '800' },
});

export const intro: IntroTheme = {
  Backdrop: FestivalBackground,
  accent: fo.vermilionDark,
  text: fo.ink,
  hint: fo.textSoft,
  bullet: fo.vermilionDark,
  fontFamily: FONT_FORTUNE,
  dialog: { backgroundColor: fo.paper, borderColor: fo.vermilionDark, borderWidth: 3, borderRadius: 6 },
  Decor: HankoDecor,
};
