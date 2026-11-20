import React, { useMemo } from 'react';
import { ImageBackground, StyleSheet, View, useWindowDimensions } from 'react-native';
import { food as f, FOODLAND_BG_IMAGE } from '../gameThemes/foodLandTheme';

type Props = { children?: React.ReactNode };

const SKY = [f.skyTop, f.sky2, f.skyMid, f.sky4, f.skyLow, f.skyEnd];

// Small deterministic pseudo-random so the sprinkles stay in the same place on every render.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function Donut({ size }: { size: number }) {
  const bits = [
    { x: 0.3, y: 0.22, r: '25deg', c: f.custard },
    { x: 0.62, y: 0.2, r: '-30deg', c: f.mint },
    { x: 0.78, y: 0.5, r: '70deg', c: f.cream },
    { x: 0.2, y: 0.55, r: '-60deg', c: f.cream },
    { x: 0.5, y: 0.8, r: '15deg', c: f.custard },
  ];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 26, right: 22, width: size, height: size }}>
      {/* warm halo */}
      {[2.1, 1.7, 1.35].map((k, i) => (
        <View
          key={i}
          style={{ position: 'absolute', left: (size - size * k) / 2, top: (size - size * k) / 2, width: size * k, height: size * k, borderRadius: size, backgroundColor: f.custard, opacity: 0.05 }}
        />
      ))}
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: f.dough }} />
      <View style={{ position: 'absolute', left: size * 0.06, top: size * 0.04, width: size * 0.88, height: size * 0.84, borderRadius: size, backgroundColor: f.frosting }} />
      {bits.map((b, i) => (
        <View
          key={i}
          style={{ position: 'absolute', left: size * b.x, top: size * b.y, width: size * 0.13, height: size * 0.05, borderRadius: 3, backgroundColor: b.c, transform: [{ rotate: b.r }] }}
        />
      ))}
      <View style={{ position: 'absolute', left: size * 0.34, top: size * 0.34, width: size * 0.32, height: size * 0.32, borderRadius: size, backgroundColor: f.skyTop }} />
    </View>
  );
}

function Cloud({ x, y, w }: { x: `${number}%`; y: number; w: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: w, height: w * 0.3 }}>
      <View style={{ position: 'absolute', bottom: 0, width: w, height: w * 0.22, borderRadius: w, backgroundColor: f.cream, opacity: 0.1 }} />
      <View style={{ position: 'absolute', bottom: w * 0.1, left: w * 0.2, width: w * 0.42, height: w * 0.22, borderRadius: w, backgroundColor: f.cream, opacity: 0.1 }} />
    </View>
  );
}

function Lollipop({ left, h }: { left: `${number}%`; h: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', bottom: 46, left, alignItems: 'center', opacity: 0.8 }}>
      <View style={{ width: 30, height: 30, borderRadius: 30, backgroundColor: f.frosting, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 18, height: 18, borderRadius: 18, backgroundColor: f.cream, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 7, height: 7, borderRadius: 7, backgroundColor: f.berry }} />
        </View>
      </View>
      <View style={{ width: 3, height: h, backgroundColor: f.cocoaLight }} />
    </View>
  );
}

// The Food Land: placeholder scene for the whole game screen and the rules dialogs.
export function FoodLandBackground({ children }: Props) {
  const { width } = useWindowDimensions();
  const sprinkles = useMemo(() => {
    const r = rng(11);
    return Array.from({ length: 30 }, (_, i) => ({
      x: Math.round(r() * 96),
      y: Math.round(r() * 58),
      rot: `${Math.round(r() * 180)}deg`,
      c: f.sprinkles[i % f.sprinkles.length],
    }));
  }, []);
  const drips = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 13 }, () => 9 + Math.round(r() * 14));
  }, []);

  if (FOODLAND_BG_IMAGE) {
    return (
      <ImageBackground source={FOODLAND_BG_IMAGE} resizeMode="cover" style={styles.root}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(11,37,35,${f.imageDim})` }]} />
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

      {sprinkles.map((s, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, width: 9, height: 3.5, borderRadius: 2, backgroundColor: s.c, opacity: 0.55, transform: [{ rotate: s.rot }] }}
        />
      ))}

      <Cloud x="6%" y={110} w={110} />
      <Cloud x="46%" y={190} w={150} />
      <Donut size={76} />

      {/* rolling hills */}
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 40, left: -width * 0.25, width: width * 1.0, height: 150, borderRadius: 999, backgroundColor: f.hillBack }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 36, right: -width * 0.35, width: width * 1.1, height: 120, borderRadius: 999, backgroundColor: f.hillFront }} />
      <Lollipop left="7%" h={46} />
      <Lollipop left="84%" h={60} />

      {/* the cake the land stands on: cocoa, frosting, drips */}
      <View pointerEvents="none" style={styles.cake}>
        <View style={styles.frosting} />
        <View style={styles.drips}>
          {drips.map((h, i) => (
            <View key={i} style={{ width: 9, height: h, borderBottomLeftRadius: 5, borderBottomRightRadius: 5, backgroundColor: f.frosting }} />
          ))}
        </View>
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: f.skyTop, overflow: 'hidden' },
  cake: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 44, backgroundColor: f.cocoa },
  frosting: { height: 10, backgroundColor: f.frosting },
  drips: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 6 },
});
