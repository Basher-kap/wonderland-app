import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import type { IntroTheme } from '../types';
import { FONT_DISPLAY, party as p } from './theme';
import { PartyBackground } from './PartyBackground';

// Stroop Effect: the rules are a white party card with a dashed pink frame and a row of pennants pinned to its top edge.
const FLAGS = [p.streamerPink, p.streamerMint, '#FFFFFF', p.lavender, p.streamerPink, p.streamerMint, '#FFFFFF'];

function Pennants() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={z.inner} />
      <View style={z.flags}>
        <Svg width={FLAGS.length * 30} height={28} viewBox={`0 0 ${FLAGS.length * 30} 28`}>
          {FLAGS.map((c, i) => (
            <Polygon key={i} points={`${i * 30 + 2},0 ${i * 30 + 28},0 ${i * 30 + 15},26`} fill={c} stroke={p.ink} strokeWidth={1.2} strokeLinejoin="round" />
          ))}
        </Svg>
      </View>
    </View>
  );
}

const z = StyleSheet.create({
  inner: { position: 'absolute', top: 6, left: 6, right: 6, bottom: 6, borderWidth: 2, borderColor: p.streamerPink, borderStyle: 'dashed', borderRadius: 14, opacity: 0.8 },
  flags: { position: 'absolute', top: -18, left: 0, right: 0, alignItems: 'center' },
});

export const intro: IntroTheme = {
  Backdrop: PartyBackground,
  accent: p.title,
  text: p.ink,
  hint: p.inkSoft,
  bullet: p.accent,
  fontFamily: FONT_DISPLAY,
  dialog: { backgroundColor: p.paper, borderColor: p.ink, borderWidth: 3, borderRadius: 18 },
  Decor: Pennants,
};
