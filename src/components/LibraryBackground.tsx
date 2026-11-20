import React, { useMemo } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { WORDLE_BG_IMAGE, wordle as w } from '../gameThemes/wordleTheme';

type Props = { children?: React.ReactNode };

// Small deterministic pseudo-random so the shelves stay the same on every render.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function ShelfRow({ seed }: { seed: number }) {
  const spines = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: 24 }, () => ({
      h: 34 + Math.floor(r() * 26),
      flex: 0.6 + r() * 0.9,
      color: w.spines[Math.floor(r() * w.spines.length)],
    }));
  }, [seed]);
  return (
    <View>
      <View style={styles.books}>
        {spines.map((b, i) => (
          <View key={i} style={{ flex: b.flex, height: b.h, backgroundColor: b.color, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(0,0,0,0.35)' }} />
        ))}
      </View>
      <View style={styles.plank} />
    </View>
  );
}

// The reading room after hours, for the whole Wordle screen and its rules dialogs:
// dim bookshelves at the top, a dark wood wall, and one lamp lighting the middle.
export function LibraryBackground({ children }: Props) {
  if (WORDLE_BG_IMAGE) {
    return (
      <ImageBackground source={WORDLE_BG_IMAGE} resizeMode="cover" style={styles.root}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,12,8,0.3)' }]} />
        {children}
      </ImageBackground>
    );
  }
  const glow = [1, 0.78, 0.56, 0.36];
  const size = 420;
  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.shelves}>
        <ShelfRow seed={3} />
        <ShelfRow seed={8} />
        <ShelfRow seed={13} />
        {/* the shelves are dimmed so the title and the board stay readable */}
        <View style={styles.dimShelves} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', alignSelf: 'center', top: 150, width: size, height: size }}>
        {glow.map((k, i) => (
          <View
            key={i}
            style={{ position: 'absolute', left: (size - size * k) / 2, top: (size - size * k) / 2, width: size * k, height: size * k, borderRadius: size, backgroundColor: w.lampGlow, opacity: 0.05 }}
          />
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1D130C', overflow: 'hidden' },
  shelves: { position: 'absolute', top: 0, left: 0, right: 0 },
  books: { flexDirection: 'row', alignItems: 'flex-end', height: 62, paddingHorizontal: 4 },
  plank: { height: 7, backgroundColor: w.walnutLight, borderBottomWidth: 2, borderBottomColor: '#120B07' },
  dimShelves: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,12,8,0.55)' },
});
