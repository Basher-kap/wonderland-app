import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { HANGMAN_BG_IMAGE, west } from './theme';

type Props = { children?: React.ReactNode };

// A frontier town at dusk, for the Hangman rules dialogs and the page around the game:
// a banded sky, a low sun, two mesas and a plank boardwalk along the bottom edge.
export function WildWestBackground({ children }: Props) {
  if (HANGMAN_BG_IMAGE) {
    return (
      <ImageBackground source={HANGMAN_BG_IMAGE} resizeMode="cover" style={styles.root}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(25,10,18,0.25)' }]} />
        {children}
      </ImageBackground>
    );
  }
  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {west.sky.map((c, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: c }} />
        ))}
      </View>
      <View pointerEvents="none" style={styles.sun} />
      <View pointerEvents="none" style={[styles.mesa, { left: 0, width: '34%', height: '17%', backgroundColor: west.mesaFar }]} />
      <View pointerEvents="none" style={[styles.mesa, { right: 0, width: '46%', height: '13%', backgroundColor: west.mesaNear }]} />
      <View pointerEvents="none" style={styles.ridge} />
      <View pointerEvents="none" style={styles.boardwalk}>
        {Array.from({ length: 9 }, (_, i) => (
          <View key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i + 1) * 10}%`, width: 2, backgroundColor: west.wallLine }} />
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: west.wall, overflow: 'hidden' },
  sun: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: '22%',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: west.sun,
    opacity: 0.55,
  },
  mesa: { position: 'absolute', bottom: '19%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  ridge: { position: 'absolute', left: 0, right: 0, bottom: '17%', height: '4%', backgroundColor: west.ridge },
  boardwalk: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '17%', backgroundColor: west.wall, borderTopWidth: 4, borderTopColor: west.wood },
});
