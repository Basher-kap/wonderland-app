import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ImageBackground,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import { SPACE_BG_IMAGE, space } from '../spaceTheme';

type Props = {
  children?: React.ReactNode;
  style?: ViewStyle;
};

// Small deterministic pseudo-random so the sky stays the same on every render.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// A soft glow made of stacked see-through circles (React Native has no blur): bigger rings are fainter.
function Glow({ size, x, y, color, opacity }: { size: number; x: number; y: number; color: string; opacity: number }) {
  const steps = [1, 0.78, 0.56, 0.36, 0.2];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size }}>
      {steps.map((k, i) => {
        const d = size * k;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: (size - d) / 2,
              top: (size - d) / 2,
              width: d,
              height: d,
              borderRadius: d,
              backgroundColor: color,
              opacity: opacity / steps.length,
            }}
          />
        );
      })}
    </View>
  );
}

// A small ringed planet, half out of the screen corner. Decoration only.
function Planet({ size, x, y }: { size: number; x: number; y: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius: size, overflow: 'hidden', backgroundColor: space.planet }}>
        {/* night side */}
        <View
          style={{
            position: 'absolute',
            left: size * 0.28,
            top: -size * 0.1,
            width: size,
            height: size * 1.2,
            borderRadius: size,
            backgroundColor: 'rgba(8, 6, 28, 0.6)',
          }}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          left: -size * 0.42,
          top: size * 0.36,
          width: size * 1.84,
          height: size * 0.28,
          borderRadius: size,
          borderWidth: 2,
          borderColor: space.planetRing,
          transform: [{ rotate: '-16deg' }],
        }}
      />
    </View>
  );
}

/**
 * Full-screen space background for Home, Leaderboard, Settings and Lobby.
 * - SPACE_BG_IMAGE set (spaceTheme.ts): shows your image, dimmed by `space.imageDim`.
 * - SPACE_BG_IMAGE null: shows a placeholder (deep space, nebulae, a planet, twinkling stars).
 * The twinkle is ONE slow animation (native driver) and is switched off when the phone has
 * "reduce motion" turned on.
 */
export default function SpaceBackground({ children, style }: Props) {
  const { width, height } = useWindowDimensions();
  const t = useRef(new Animated.Value(0.5)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (SPACE_BG_IMAGE || reduceMotion) {
      t.setValue(0.6);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, t]);

  // Three groups of stars: steady, twinkling, and twinkling the other way round.
  const groups = useMemo(() => {
    const r = rng(20261120);
    const g: { key: number; left: number; top: number; size: number; opacity: number; tint: string }[][] = [[], [], []];
    for (let i = 0; i < 90; i++) {
      const big = r() > 0.9;
      g[i % 3].push({
        key: i,
        left: r(),
        top: r(),
        size: big ? 2.5 + r() : 1 + r() * 1.4,
        opacity: 0.4 + r() * 0.6,
        tint: r() > 0.8 ? space.starWarm : space.star,
      });
    }
    return g;
  }, []);

  if (SPACE_BG_IMAGE) {
    return (
      <ImageBackground source={SPACE_BG_IMAGE} resizeMode="cover" style={[styles.fill, style]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${space.imageDim})` }]} />
        {children}
      </ImageBackground>
    );
  }

  const twinkleA = t.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const twinkleB = t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });
  const wraps = [undefined, twinkleA, twinkleB];

  return (
    <View style={[styles.fill, { backgroundColor: space.bgDeep }, style]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: space.bgMid, opacity: 0.5 }]} />
      <Glow size={width * 1.5} x={width * 0.05} y={height * 0.08} color={space.bgGlowA} opacity={0.55} />
      <Glow size={width * 1.3} x={width * 0.95} y={height * 0.92} color={space.bgGlowB} opacity={0.5} />
      <Glow size={width * 0.8} x={width * 0.9} y={height * 0.45} color={space.bgGlowC} opacity={0.3} />
      <Planet size={width * 0.34} x={width * 0.78} y={-width * 0.08} />

      {groups.map((stars, gi) => {
        const Wrap: any = wraps[gi] ? Animated.View : View;
        return (
          <Wrap
            key={gi}
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, wraps[gi] ? { opacity: wraps[gi] } : null]}
          >
            {stars.map((s) => (
              <View
                key={s.key}
                style={{
                  position: 'absolute',
                  left: s.left * width,
                  top: s.top * height,
                  width: s.size,
                  height: s.size,
                  borderRadius: s.size,
                  backgroundColor: s.tint,
                  opacity: s.opacity,
                }}
              />
            ))}
          </Wrap>
        );
      })}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});