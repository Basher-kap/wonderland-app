import React from 'react';
import { ImageBackground, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ARENA_BG_IMAGE, esp } from '../gameThemes/inversionTheme';

type Props = { children?: React.ReactNode };

const BEAMS = [
  { left: '6%', width: 80, rotate: '22deg', color: 'rgba(53,224,255,0.10)' },
  { left: '40%', width: 110, rotate: '-10deg', color: 'rgba(255,79,163,0.10)' },
  { left: '74%', width: 80, rotate: '-24deg', color: 'rgba(199,125,255,0.12)' },
];
const LIGHT_COLORS = [esp.cyan, esp.magenta, esp.violet, '#FFFFFF'];
const FLOOR_LINES = [0, 14, 32, 56, 88, 128, 176]; // the LED floor: lines spread out towards the viewer

// The arena of an esports final, for the whole Inversion screen and its rules dialogs: dark sky of
// stage lights above, a glowing LED floor below, and the silhouettes of the crowd in front of it.
export function EsportsArenaBackground({ children }: Props) {
  const { width } = useWindowDimensions();
  const lights = Math.ceil(width / 34);
  const fans = Math.ceil(width / 24);
  if (ARENA_BG_IMAGE) {
    return (
      <ImageBackground source={ARENA_BG_IMAGE} resizeMode="cover" style={styles.root}>
        {children}
      </ImageBackground>
    );
  }
  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {esp.arena.map((c, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: c }} />
        ))}
      </View>
      {BEAMS.map((b, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{ position: 'absolute', top: -80, left: b.left, width: b.width, height: 760, backgroundColor: b.color, transform: [{ rotate: b.rotate }] }}
        />
      ))}
      <View pointerEvents="none" style={styles.truss}>
        {Array.from({ length: lights }, (_, i) => (
          <View key={i} style={[styles.light, { backgroundColor: LIGHT_COLORS[i % LIGHT_COLORS.length] }]} />
        ))}
      </View>
      <View pointerEvents="none" style={styles.floor}>
        {FLOOR_LINES.map((b) => (
          <View key={b} style={{ position: 'absolute', left: 0, right: 0, bottom: b, height: 1, backgroundColor: 'rgba(53,224,255,0.22)' }} />
        ))}
        {Array.from({ length: 11 }, (_, i) => (
          <View key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${i * 10}%`, width: 1, backgroundColor: 'rgba(53,224,255,0.12)' }} />
        ))}
      </View>
      <View pointerEvents="none" style={styles.crowd}>
        {Array.from({ length: fans }, (_, i) => {
          const lift = (i * 37) % 11;
          return (
            <View key={i} style={{ width: 24, alignItems: 'center', marginBottom: -lift }}>
              {i % 6 === 2 && (
                <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: i % 12 === 2 ? esp.cyan : esp.magenta, marginBottom: -4, transform: [{ rotate: '14deg' }] }} />
              )}
              <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: esp.crowd }} />
              <View style={{ width: 24, height: 20, borderTopLeftRadius: 11, borderTopRightRadius: 11, backgroundColor: esp.crowd }} />
            </View>
          );
        })}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: esp.arena[0], overflow: 'hidden' },
  truss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: esp.truss,
    borderBottomWidth: 2,
    borderBottomColor: esp.trussEdge,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  light: { width: 6, height: 6, borderRadius: 3 },
  floor: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '30%', overflow: 'hidden', backgroundColor: 'rgba(53,224,255,0.04)' },
  crowd: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 44, flexDirection: 'row', alignItems: 'flex-end' },
});
