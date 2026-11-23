import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, ImageBackground, StyleSheet, View } from 'react-native';
import { cosmos as c, SUGOROKU_BG_IMAGE } from './theme';

type Props = { children?: React.ReactNode };

const VOID = [c.void1, c.void2, c.void3, c.void4, c.void5];

// Small deterministic pseudo-random so the sky stays the same on every render.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// A far-off ring of light, the portal of the lost dimension, high in a corner of the sky.
function DistantPortal() {
  return (
    <View pointerEvents="none" style={styles.portal}>
      <View style={{ position: 'absolute', width: 190, height: 190, borderRadius: 190, backgroundColor: c.nebulaCyan, opacity: 0.05 }} />
      <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 120, backgroundColor: c.portal, opacity: 0.06 }} />
      <View style={{ width: 84, height: 84, borderRadius: 84, borderWidth: 3, borderColor: c.portal, opacity: 0.35 }} />
      <View style={{ position: 'absolute', width: 54, height: 54, borderRadius: 54, borderWidth: 1.5, borderColor: c.portalViolet, opacity: 0.4 }} />
    </View>
  );
}

// The sky of the lost dimension, for the whole Future Sugoroku screen and its rules dialogs: a
// deep indigo void, nebula glows, a field of stars (some twinkle, not with reduce-motion),
// drifting stone shards and a faint portal far away. The edges are darker than the middle.
export function CosmosBackground({ children }: Props) {
  const [still, setStill] = useState(false);
  const twinkle = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
  }, []);
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { toValue: 0.25, duration: 1800, useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 1, duration: 2200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [still, twinkle]);

  const stars = useMemo(() => {
    const r = rng(41);
    return Array.from({ length: 70 }, (_, i) => ({
      x: Math.round(r() * 98),
      y: Math.round(r() * 96),
      s: r() < 0.15 ? 3 : 2,
      o: 0.25 + r() * 0.55,
      gold: i % 7 === 0,
      blink: i % 3 === 0,
    }));
  }, []);
  const shards = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 9 }, () => ({
      x: Math.round(r() * 92),
      y: Math.round(8 + r() * 84),
      w: 10 + Math.round(r() * 16),
      rot: Math.round(r() * 80 - 40),
    }));
  }, []);

  if (SUGOROKU_BG_IMAGE) {
    return (
      <ImageBackground source={SUGOROKU_BG_IMAGE} resizeMode="cover" style={styles.root}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,2,13,0.35)' }]} />
        {children}
      </ImageBackground>
    );
  }

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {VOID.map((col, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: col }} />
        ))}
      </View>

      {/* nebula glows */}
      <View pointerEvents="none" style={{ position: 'absolute', top: '18%', left: -90, width: 300, height: 300, borderRadius: 300, backgroundColor: c.nebulaViolet, opacity: 0.1 }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: '52%', right: -110, width: 320, height: 320, borderRadius: 320, backgroundColor: c.nebulaCyan, opacity: 0.06 }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: -80, left: '10%', width: 260, height: 200, borderRadius: 200, backgroundColor: c.nebulaViolet, opacity: 0.08 }} />

      <DistantPortal />

      {/* stars */}
      {stars.map((s, i) => {
        const dot = (
          <View style={{ width: s.s, height: s.s, borderRadius: s.s, backgroundColor: s.gold ? c.star : c.bone, opacity: s.o }} />
        );
        return s.blink ? (
          <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, opacity: twinkle }}>
            {dot}
          </Animated.View>
        ) : (
          <View key={i} pointerEvents="none" style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%` }}>
            {dot}
          </View>
        );
      })}

      {/* stone shards drifting in the void */}
      {shards.map((k, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{ position: 'absolute', left: `${k.x}%`, top: `${k.y}%`, width: k.w, height: k.w * 0.7, backgroundColor: c.stoneLo, borderWidth: 1, borderColor: c.stoneEdge, opacity: 0.45, transform: [{ rotate: `${k.rot}deg` }] }}
        />
      ))}

      {/* the dark closes in at the sides */}
      {[0, 1, 2, 3].map((i) => (
        <View key={`l${i}`} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: i * 14, width: 14, backgroundColor: `rgba(0,0,0,${0.45 - i * 0.1})` }} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <View key={`r${i}`} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, right: i * 14, width: 14, backgroundColor: `rgba(0,0,0,${0.45 - i * 0.1})` }} />
      ))}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.void1, overflow: 'hidden' },
  portal: { position: 'absolute', top: 36, right: 24, width: 190, height: 190, alignItems: 'center', justifyContent: 'center' },
});
