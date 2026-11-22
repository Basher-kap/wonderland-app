import React from 'react';
import { View } from 'react-native';
import type { IntroTheme } from '../types';
import { court as ct, FONT_COURT } from './theme';
import { CourtBackground } from './CourtBackground';
import { JusticeScales } from './JusticeScales';

// Janken Negotiation: the rules are a case file under the scales of justice.
function ScalesDecor() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center' }}>
      <JusticeScales size={30} color={ct.steel} />
    </View>
  );
}

export const intro: IntroTheme = {
  Backdrop: CourtBackground,
  accent: ct.skyPale,
  text: ct.text,
  hint: ct.muted,
  bullet: ct.skyPale,
  fontFamily: FONT_COURT,
  dialog: { backgroundColor: ct.panel, borderColor: ct.steelDim, borderWidth: 3, borderRadius: 3, paddingTop: 54 },
  Decor: ScalesDecor,
};
