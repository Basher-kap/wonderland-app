import React from 'react';
import { ImageBackground, StyleSheet, useWindowDimensions, View } from 'react-native';
import { NAUMACHIA_BG_IMAGE, roma } from './theme';

type Props = { children?: React.ReactNode };

export const AWNING_H = 26; // the velarium along the top edge: games keep clear of it

const WAVES = [
  { top: '58%', left: '8%', width: 70 },
  { top: '64%', left: '55%', width: 90 },
  { top: '72%', left: '18%', width: 110 },
  { top: '80%', left: '62%', width: 60 },
  { top: '88%', left: '30%', width: 100 },
  { top: '94%', left: '70%', width: 80 },
] as const;

// A flame on a stand, for the wall.
function Torch({ left }: { left: string }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 72, left: left as `${number}%`, alignItems: 'center' }}>
      <View style={{ width: 12, height: 18, backgroundColor: roma.fire, borderRadius: 7, transform: [{ rotate: '8deg' }] }} />
      <View style={{ position: 'absolute', top: 6, width: 6, height: 11, backgroundColor: roma.fireLight, borderRadius: 4 }} />
      <View style={{ width: 20, height: 9, backgroundColor: roma.bronze, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, marginTop: -2 }} />
      <View style={{ width: 4, height: 26, backgroundColor: roma.woodDark }} />
    </View>
  );
}

// The Naumachia, for the whole Battleships screen and its rules dialogs: an amphitheatre wall with
// two rows of arches under a red-and-cream awning, torches, and the flooded arena below.
export function NaumachiaBackground({ children }: Props) {
  const { width } = useWindowDimensions();
  const stripes = Math.ceil(width / 30);
  const arches = Math.ceil(width / 38);
  if (NAUMACHIA_BG_IMAGE) {
    return (
      <ImageBackground source={NAUMACHIA_BG_IMAGE} resizeMode="cover" style={styles.root}>
        {children}
      </ImageBackground>
    );
  }
  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.water}>
        {roma.water.map((c, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: c }} />
        ))}
      </View>
      {WAVES.map((w, i) => (
        <View key={i} pointerEvents="none" style={{ position: 'absolute', top: w.top, left: w.left, width: w.width, height: 3, borderRadius: 2, backgroundColor: 'rgba(232,244,242,0.14)' }} />
      ))}
      <View pointerEvents="none" style={styles.wall}>
        {[0, 1].map((row) => (
          <View key={row} style={[styles.archRow, { top: AWNING_H + 14 + row * 62 }]}>
            {Array.from({ length: arches }, (_, i) => (
              <View key={i} style={[styles.arch, { height: row === 0 ? 42 : 50 }]} />
            ))}
          </View>
        ))}
        <View style={[styles.cornice, { top: AWNING_H + 8 }]} />
        <View style={[styles.cornice, { top: AWNING_H + 14 + 62 + 56 }]} />
      </View>
      <Torch left="4%" />
      <Torch left="90%" />
      <View pointerEvents="none" style={styles.awning}>
        {Array.from({ length: stripes }, (_, i) => (
          <View key={i} style={[styles.stripe, { backgroundColor: i % 2 ? roma.velaCream : roma.velaRed }]} />
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: roma.water[1], overflow: 'hidden' },
  water: { ...StyleSheet.absoluteFill },
  wall: { position: 'absolute', top: 0, left: 0, right: 0, height: 190, backgroundColor: roma.stone, borderBottomWidth: 8, borderBottomColor: roma.stoneDark },
  archRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 52 },
  arch: { width: 26, backgroundColor: roma.arch, borderTopLeftRadius: 13, borderTopRightRadius: 13 },
  cornice: { position: 'absolute', left: 0, right: 0, height: 5, backgroundColor: roma.stoneDark },
  awning: { position: 'absolute', top: 0, left: 0, right: 0, height: AWNING_H, flexDirection: 'row' },
  stripe: { width: 30, height: AWNING_H, borderBottomLeftRadius: 15, borderBottomRightRadius: 15 },
});
