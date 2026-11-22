import React, { useMemo } from 'react';
import { ImageBackground, StyleSheet, View, useWindowDimensions } from 'react-native';
import { fortune as p, FORTUNE_BG_IMAGE } from './theme';

type Props = { children?: React.ReactNode };

const SKY = [p.sky1, p.sky2, p.sky3, p.sky4, p.sky5, p.sky6];

// Small deterministic pseudo-random so the sky stays the same on every render.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function Lantern({ x, drop }: { x: number; drop: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: `${x}%`, top: 0, alignItems: 'center', width: 0 }}>
      <View style={{ width: 2, height: drop, backgroundColor: p.woodEdge }} />
      <View style={{ width: 64, height: 64, borderRadius: 64, backgroundColor: p.lantern, opacity: 0.1, position: 'absolute', top: drop - 16 }} />
      <View style={{ width: 20, height: 4, backgroundColor: p.gold }} />
      <View style={{ width: 24, height: 30, borderRadius: 12, backgroundColor: p.vermilion, borderColor: p.vermilionDark, borderWidth: 1 }} />
      <View style={{ width: 20, height: 4, backgroundColor: p.gold }} />
    </View>
  );
}

function Torii() {
  return (
    <View pointerEvents="none" style={styles.torii}>
      <View style={{ position: 'absolute', top: 0, left: 0, width: 108, height: 10, borderRadius: 3, backgroundColor: p.roof }} />
      <View style={{ position: 'absolute', top: 10, left: 6, width: 96, height: 6, backgroundColor: p.vermilion }} />
      <View style={{ position: 'absolute', top: 28, left: 14, width: 80, height: 6, backgroundColor: p.vermilion }} />
      <View style={{ position: 'absolute', top: 10, left: 16, width: 8, height: 74, backgroundColor: p.vermilion }} />
      <View style={{ position: 'absolute', top: 10, left: 84, width: 8, height: 74, backgroundColor: p.vermilion }} />
    </View>
  );
}

function StoneLantern() {
  return (
    <View pointerEvents="none" style={styles.toro}>
      <View style={{ width: 30, height: 6, borderRadius: 2, backgroundColor: p.stone }} />
      <View style={{ width: 22, height: 18, backgroundColor: p.stone, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 10, height: 10, backgroundColor: p.lantern }} />
      </View>
      <View style={{ width: 8, height: 16, backgroundColor: p.stone }} />
      <View style={{ width: 20, height: 6, backgroundColor: p.stone }} />
    </View>
  );
}

function Pine({ left, size }: { left: `${number}%`; size: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', bottom: 38, left, alignItems: 'center' }}>
      {[0.55, 0.75, 1].map((k, i) => (
        <View
          key={i}
          style={{ marginTop: i === 0 ? 0 : -size * 0.2, width: 0, height: 0, borderLeftWidth: size * k * 0.5, borderRightWidth: size * k * 0.5, borderBottomWidth: size * 0.42, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: p.pine }}
        />
      ))}
      <View style={{ width: 6, height: size * 0.18, backgroundColor: p.roof }} />
    </View>
  );
}

// The festival ground, for the whole Fortune screen and its rules dialogs: a night sky with a moon,
// strings of paper lanterns, a torii gate and a stone lantern, pines, and stall lights along the path.
export function FestivalBackground({ children }: Props) {
  const { width } = useWindowDimensions();
  const stars = useMemo(() => {
    const r = rng(17);
    return Array.from({ length: 26 }, () => ({ x: Math.round(r() * 96), y: Math.round(r() * 42), o: 0.25 + r() * 0.4 }));
  }, []);

  if (FORTUNE_BG_IMAGE) {
    return (
      <ImageBackground source={FORTUNE_BG_IMAGE} resizeMode="cover" style={styles.root}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,16,32,0.3)' }]} />
        {children}
      </ImageBackground>
    );
  }

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {SKY.map((c, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: c }} />
        ))}
      </View>

      {stars.map((s, i) => (
        <View key={i} pointerEvents="none" style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, width: 3, height: 3, borderRadius: 3, backgroundColor: '#FFFFFF', opacity: s.o }} />
      ))}

      {/* moon */}
      <View pointerEvents="none" style={styles.moonWrap}>
        <View style={{ position: 'absolute', left: -24, top: -24, width: 92, height: 92, borderRadius: 92, backgroundColor: p.moon, opacity: 0.07 }} />
        <View style={{ width: 44, height: 44, borderRadius: 44, backgroundColor: p.moon }} />
      </View>

      {/* two strings of paper lanterns */}
      <View pointerEvents="none" style={[styles.string, { top: 8 }]} />
      {[6, 22, 38, 54, 70, 86].map((x, i) => (
        <View key={x} pointerEvents="none" style={{ position: 'absolute', top: 9, left: 0, right: 0 }}>
          <Lantern x={x} drop={4 + (i % 3) * 5} />
        </View>
      ))}
      <View pointerEvents="none" style={[styles.string, { top: 64 }]} />
      {[14, 30, 46, 62, 78].map((x, i) => (
        <View key={x} pointerEvents="none" style={{ position: 'absolute', top: 65, left: 0, right: 0 }}>
          <Lantern x={x} drop={4 + ((i + 1) % 3) * 5} />
        </View>
      ))}

      <Pine left="2%" size={84} />
      <Pine left="14%" size={60} />
      <StoneLantern />
      <Torii />

      {/* the path, with stall lights along it */}
      <View pointerEvents="none" style={styles.ground}>
        <View style={styles.path} />
        <View style={styles.stalls}>
          {Array.from({ length: Math.max(8, Math.floor(width / 36)) }, (_, i) => (
            <View key={i} style={{ width: 7, height: 7, borderRadius: 7, backgroundColor: p.lantern, opacity: 0.85 }} />
          ))}
        </View>
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: p.sky1, overflow: 'hidden' },
  moonWrap: { position: 'absolute', top: 120, right: 30, width: 44, height: 44 },
  string: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: p.woodEdge },
  torii: { position: 'absolute', bottom: 40, right: 14, width: 108, height: 94, opacity: 0.95 },
  toro: { position: 'absolute', bottom: 40, left: '34%', alignItems: 'center' },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 40, backgroundColor: p.ground },
  path: { height: 3, backgroundColor: p.woodEdge, opacity: 0.6 },
  stalls: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
});
