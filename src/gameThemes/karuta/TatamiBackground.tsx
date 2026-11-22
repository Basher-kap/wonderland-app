import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, ImageBackground, StyleSheet, View, useWindowDimensions } from 'react-native';
import { KARUTA_BG_IMAGE, SCENE_HEIGHT, washitsu as w } from './theme';
import { Furin } from './Furin';

type Props = { children?: React.ReactNode };

const SKY = [w.sky1, w.sky2, w.sky3, w.sky4, w.sky5];
const MAT_H = 88;

// Small deterministic pseudo-random so the room stays the same on every render.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// A sliding door: a wooden frame with a lattice of paper panes.
function Shoji({ side }: { side: 'left' | 'right' }) {
  return (
    <View pointerEvents="none" style={[styles.shoji, side === 'left' ? { left: 0 } : { right: 0 }]}>
      {Array.from({ length: 6 }, (_, r) => (
        <View key={r} style={{ flex: 1, flexDirection: 'row' }}>
          {Array.from({ length: 3 }, (_, c) => (
            <View key={c} style={{ flex: 1, margin: 1, backgroundColor: (r + c) % 2 ? w.shoji : w.shojiLit }} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Pine({ left, size }: { left: `${number}%`; size: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', bottom: 22, left, alignItems: 'center' }}>
      {[0.6, 1].map((k, i) => (
        <View
          key={i}
          style={{ marginTop: i === 0 ? 0 : -size * 0.18, width: 0, height: 0, borderLeftWidth: size * k * 0.5, borderRightWidth: size * k * 0.5, borderBottomWidth: size * 0.45, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: w.pine }}
        />
      ))}
      <View style={{ width: 4, height: size * 0.14, backgroundColor: w.pine }} />
    </View>
  );
}

// One row of tatami mats. Every other row is shifted by half a mat, as in a real room.
function MatRow({ index }: { index: number }) {
  const flexes = index % 2 === 0 ? [1, 1] : [0.5, 1, 0.5];
  return (
    <View style={{ flexDirection: 'row', height: MAT_H }}>
      {flexes.map((f, i) => (
        <View
          key={i}
          style={{
            flex: f,
            backgroundColor: (index + i) % 2 ? w.tatamiA : w.tatamiB,
            borderTopWidth: 4,
            borderBottomWidth: 4,
            borderTopColor: w.heri,
            borderBottomColor: w.heri,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderLeftColor: w.tatamiEdge,
            borderRightColor: w.tatamiEdge,
            justifyContent: 'space-evenly',
          }}
        >
          {[0, 1, 2].map((l) => (
            <View key={l} style={{ height: 1, backgroundColor: '#000', opacity: 0.07 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// The washitsu, for the whole Karuta screen and its rules dialogs: the open doors with the dusk
// garden and a wind chime at the top, the tatami floor with the warm light spilling over it below.
export function TatamiBackground({ children }: Props) {
  const { height, width } = useWindowDimensions();
  const [still, setStill] = useState(false);
  const blink = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
  }, []);
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [still, blink]);

  const flies = useMemo(() => {
    const r = rng(31);
    return Array.from({ length: 9 }, (_, i) => ({ x: 14 + Math.round(r() * 72), y: SCENE_HEIGHT - 110 + Math.round(r() * 150), alt: i % 2 === 1 }));
  }, []);

  if (KARUTA_BG_IMAGE) {
    return (
      <ImageBackground source={KARUTA_BG_IMAGE} resizeMode="cover" style={styles.root}>
        {children}
      </ImageBackground>
    );
  }

  const floorH = Math.max(0, height - SCENE_HEIGHT);
  const rows = Math.ceil(floorH / MAT_H) + 2;
  const dim = blink.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.95] });
  const bright = blink.interpolate({ inputRange: [0, 1], outputRange: [0.95, 0.25] });

  return (
    <View style={styles.root}>
      {/* the garden seen through the open doors */}
      <View pointerEvents="none" style={styles.scene}>
        <View style={StyleSheet.absoluteFill}>
          {SKY.map((c, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: c }} />
          ))}
        </View>
        <View style={styles.moonWrap}>
          <View style={{ position: 'absolute', left: -18, top: -18, width: 70, height: 70, borderRadius: 70, backgroundColor: w.moon, opacity: 0.12 }} />
          <View style={{ width: 34, height: 34, borderRadius: 34, backgroundColor: w.moon, opacity: 0.9 }} />
        </View>
        <View style={{ position: 'absolute', bottom: 18, left: -width * 0.2, width: width * 0.9, height: 90, borderRadius: 999, backgroundColor: w.hillFar, opacity: 0.75 }} />
        <View style={{ position: 'absolute', bottom: 8, right: -width * 0.25, width: width * 1.0, height: 80, borderRadius: 999, backgroundColor: w.hillNear }} />
        <Pine left="26%" size={44} />
        <Pine left="62%" size={34} />
      </View>

      {/* the floor */}
      <View pointerEvents="none" style={[styles.floor, { top: SCENE_HEIGHT }]}>
        {Array.from({ length: rows }, (_, i) => (
          <MatRow key={i} index={i} />
        ))}
      </View>
      {/* warm light spilling in over the mats */}
      {[0.2, 0.14, 0.09, 0.05, 0.025].map((o, i) => (
        <View key={i} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: SCENE_HEIGHT + i * 30, height: 30, backgroundColor: w.sun, opacity: o }} />
      ))}

      {/* the veranda, the doors and the beam above */}
      <View pointerEvents="none" style={[styles.engawa, { top: SCENE_HEIGHT - 14 }]} />
      <Shoji side="left" />
      <Shoji side="right" />
      <View pointerEvents="none" style={styles.beam} />

      {/* fireflies */}
      {!still &&
        flies.map((f, i) => (
          <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', left: `${f.x}%`, top: f.y, width: 4, height: 4, borderRadius: 4, backgroundColor: w.firefly, opacity: f.alt ? bright : dim }} />
        ))}

      <View pointerEvents="none" style={{ position: 'absolute', top: 14, left: '70%' }}>
        <Furin />
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: w.tatamiA, overflow: 'hidden' },
  scene: { position: 'absolute', top: 0, left: 0, right: 0, height: SCENE_HEIGHT, overflow: 'hidden' },
  moonWrap: { position: 'absolute', top: 48, left: '40%', width: 34, height: 34 },
  floor: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  engawa: { position: 'absolute', left: 0, right: 0, height: 14, backgroundColor: w.engawa, borderTopWidth: 2, borderTopColor: w.wood, borderBottomWidth: 3, borderBottomColor: w.wood },
  shoji: { position: 'absolute', top: 0, width: '18%', height: SCENE_HEIGHT - 14, backgroundColor: w.wood, padding: 2 },
  beam: { position: 'absolute', top: 0, left: 0, right: 0, height: 12, backgroundColor: w.wood, borderBottomWidth: 2, borderBottomColor: w.woodLight },
});
