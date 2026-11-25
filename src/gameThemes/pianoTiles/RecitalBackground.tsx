import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { stage as s, PIANO_BG_IMAGE } from './theme';

type Props = { children?: React.ReactNode };

const LACQUER = [s.black1, s.black2, s.black3, s.black4, s.black5];

// The recital stage, for the whole Piano Tiles screen and its rules dialogs: black lacquer, one warm
// spotlight cone from the ceiling, a faint gold floor line and curtains of darkness at the sides.
export function RecitalBackground({ children }: Props) {
  if (PIANO_BG_IMAGE) {
    return (
      <ImageBackground source={PIANO_BG_IMAGE} resizeMode="cover" style={styles.root}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,5,8,0.4)' }]} />
        {children}
      </ImageBackground>
    );
  }
  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {LACQUER.map((col, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: col }} />
        ))}
      </View>

      {/* the spotlight: a cone that widens towards the stage */}
      <View pointerEvents="none" style={styles.spotWrap}>
        <View style={styles.spot} />
      </View>

      {/* a faint line of keys along the floor */}
      <View pointerEvents="none" style={styles.keys}>
        {Array.from({ length: 22 }, (_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: i % 2 === 0 ? s.ivory : s.ebony, opacity: 0.07 }} />
        ))}
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 26, height: 2, backgroundColor: s.gold, opacity: 0.25 }} />

      {/* the dark closes in at the sides */}
      {[0, 1, 2, 3].map((i) => (
        <View key={`l${i}`} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: i * 14, width: 14, backgroundColor: `rgba(0,0,0,${0.5 - i * 0.12})` }} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <View key={`r${i}`} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, right: i * 14, width: 14, backgroundColor: `rgba(0,0,0,${0.5 - i * 0.12})` }} />
      ))}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: s.black1, overflow: 'hidden' },
  spotWrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  spot: {
    width: 0,
    height: 0,
    borderLeftWidth: 200,
    borderRightWidth: 200,
    borderBottomWidth: 640,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(226,184,79,0.05)',
  },
  keys: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 24, flexDirection: 'row' },
});
