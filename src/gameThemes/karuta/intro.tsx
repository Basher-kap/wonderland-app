import React from 'react';
import { View } from 'react-native';
import type { IntroTheme } from '../types';
import { FONT_KARUTA, washitsu as wa } from './theme';
import { Furin } from './Furin';
import { TatamiBackground } from './TatamiBackground';

// Karuta: the rules are a sheet of washi paper in a wooden frame, with a wind chime hanging in it.
function FurinDecor() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 22 }}>
      <Furin />
    </View>
  );
}

export const intro: IntroTheme = {
  Backdrop: TatamiBackground,
  accent: wa.indigo,
  text: wa.ink,
  hint: wa.ink,
  bullet: wa.vermilion,
  fontFamily: FONT_KARUTA,
  dialog: { backgroundColor: wa.paper, borderColor: wa.wood, borderWidth: 5, borderRadius: 4 },
  Decor: FurinDecor,
};
