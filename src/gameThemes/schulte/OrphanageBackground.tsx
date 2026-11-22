import React from 'react';
import { ImageBackground, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { KIDS_BG_IMAGE, kids } from './theme';

type Props = { children?: React.ReactNode };

export const FLOOR_H = 22; // the wooden floor along the bottom edge: games keep clear of it
export const BUNTING_H = 28; // the paper flags along the top edge

const STARS = [
  { left: '7%', bottom: '27%', color: '#F4A092', size: 22 },
  { left: '30%', bottom: '32%', color: '#F7D56B', size: 16 },
  { left: '64%', bottom: '26%', color: '#CDB6EE', size: 20 },
  { left: '88%', bottom: '31%', color: '#A5DDBB', size: 18 },
] as const;

// A children's home on a bright morning, for the whole Schulte screen and its rules dialogs:
// a striped wall with a pale blue lower panel, bunting, sun rays and a wooden floor.
export function OrphanageBackground({ children }: Props) {
  const { width } = useWindowDimensions();
  const flags = Math.ceil(width / 28);
  if (KIDS_BG_IMAGE) {
    return (
      <ImageBackground source={KIDS_BG_IMAGE} resizeMode="cover" style={styles.root}>
        {children}
      </ImageBackground>
    );
  }
  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
        {Array.from({ length: 14 }, (_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? kids.wallStripe : kids.wall }} />
        ))}
      </View>
      <View pointerEvents="none" style={styles.wainscot} />
      {STARS.map((s, i) => (
        <Text key={i} pointerEvents="none" style={{ position: 'absolute', left: s.left, bottom: s.bottom, color: s.color, fontSize: s.size, opacity: 0.7 }}>
          ★
        </Text>
      ))}
      {/* sunlight, falling from a window above the top-right corner */}
      <View pointerEvents="none" style={[styles.ray, { right: 10, width: 46 }]} />
      <View pointerEvents="none" style={[styles.ray, { right: 96, width: 92 }]} />
      <View pointerEvents="none" style={styles.bunting}>
        <View style={styles.string} />
        <View style={{ flexDirection: 'row', marginLeft: -2 }}>
          {Array.from({ length: flags }, (_, i) => (
            <View key={i} style={[styles.flag, { borderTopColor: kids.blocks[i % kids.blocks.length].face }]} />
          ))}
        </View>
      </View>
      <View pointerEvents="none" style={styles.floor} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: kids.wall, overflow: 'hidden' },
  wainscot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: FLOOR_H,
    height: '32%',
    backgroundColor: kids.wainscot,
    borderTopWidth: 5,
    borderTopColor: kids.rail,
  },
  ray: { position: 'absolute', top: -40, height: 900, backgroundColor: kids.ray, transform: [{ rotate: '-26deg' }] },
  bunting: { position: 'absolute', top: 0, left: 0, right: 0, height: BUNTING_H },
  string: { height: 2, marginTop: 3, backgroundColor: kids.inkSoft, opacity: 0.6 },
  flag: {
    width: 0,
    height: 0,
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderTopWidth: 22,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  floor: { position: 'absolute', left: 0, right: 0, bottom: 0, height: FLOOR_H, backgroundColor: kids.floor, borderTopWidth: 4, borderTopColor: kids.floorLine },
});
