import React, { useMemo } from 'react';
import { ImageBackground, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { ViewStyle } from 'react-native';
import { SPACE_BG_IMAGE, space } from '../spaceTheme';

type Props = {
  children?: React.ReactNode;
  style?: ViewStyle;
};

// Small deterministic pseudo-random so stars stay in the same place on every render.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Full-screen space background for Home, Leaderboard, Settings and Lobby.
 * - SPACE_BG_IMAGE set (spaceTheme.ts): shows your image, dimmed by `space.imageDim`.
 * - SPACE_BG_IMAGE null: shows a placeholder (deep-space colour, two nebula glows, stars).
 */
export default function SpaceBackground({ children, style }: Props) {
  const { width, height } = useWindowDimensions();

  const stars = useMemo(() => {
    const r = rng(20261120);
    return Array.from({ length: 70 }, (_, i) => ({
      key: i,
      left: r() * 100,
      top: r() * 100,
      size: 1 + r() * 2,
      opacity: 0.35 + r() * 0.65,
    }));
  }, []);

  if (SPACE_BG_IMAGE) {
    return (
      <ImageBackground source={SPACE_BG_IMAGE} resizeMode="cover" style={[styles.fill, style]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${space.imageDim})` }]} />
        {children}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: space.bgDeep }, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: space.bgMid, opacity: 0.55 }]} />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: width * 1.1,
          height: width * 1.1,
          borderRadius: width,
          top: -width * 0.4,
          left: -width * 0.35,
          backgroundColor: space.bgGlowA,
          opacity: 0.35,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: width,
          height: width,
          borderRadius: width,
          bottom: -width * 0.35,
          right: -width * 0.4,
          backgroundColor: space.bgGlowB,
          opacity: 0.3,
        }}
      />
      {stars.map((s) => (
        <View
          key={s.key}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: (s.left / 100) * width,
            top: (s.top / 100) * height,
            width: s.size,
            height: s.size,
            borderRadius: s.size,
            backgroundColor: space.star,
            opacity: s.opacity,
          }}
        />
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});