import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { IntroTheme } from '../types';
import { den, FONT_DEN } from './theme';
import { BlackMarketBackground } from './BlackMarketBackground';

// Russian Roulette: the rules are a worn dark card with a gold rim and four steel rivets in the corners.
function Rivets() {
  const spot = (style: object) => <View pointerEvents="none" style={[s.rivet, style]} />;
  return (
    <>
      {spot({ top: 7, left: 7 })}
      {spot({ top: 7, right: 7 })}
      {spot({ bottom: 7, left: 7 })}
      {spot({ bottom: 7, right: 7 })}
    </>
  );
}

const s = StyleSheet.create({
  rivet: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: den.steel, borderWidth: 1, borderColor: den.black },
});

export const intro: IntroTheme = {
  Backdrop: BlackMarketBackground,
  accent: den.gold,
  text: den.bone,
  hint: den.boneMuted,
  bullet: den.bloodBright,
  fontFamily: FONT_DEN,
  dialog: { backgroundColor: '#150E0C', borderColor: den.gold, borderWidth: 2, borderRadius: 4, paddingTop: 30 },
  Decor: Rivets,
};
