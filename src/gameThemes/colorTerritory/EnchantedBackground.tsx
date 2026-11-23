import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, ImageBackground, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { TERRITORY_BG_IMAGE, glade as g } from './theme';

type Props = { children?: React.ReactNode };

// Small deterministic pseudo-random so the sky stays the same on every render.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// A castle on the far hill: three towers with pointed roofs and one lit window.
function castle(x: number, base: number, scale: number) {
  const w = 14 * scale;
  const h = 38 * scale;
  return (
    <React.Fragment key={x}>
      <Rect x={x} y={base - h} width={w} height={h} fill={g.castle} />
      <Path d={`M${x - 2 * scale} ${base - h} L${x + w / 2} ${base - h - 18 * scale} L${x + w + 2 * scale} ${base - h} Z`} fill={g.castle} />
      <Rect x={x + w + 3 * scale} y={base - h * 0.7} width={w * 0.8} height={h * 0.7} fill={g.castle} />
      <Path
        d={`M${x + w + 2 * scale} ${base - h * 0.7} L${x + w + 3 * scale + w * 0.4} ${base - h * 0.7 - 14 * scale} L${x + w + 4 * scale + w * 0.8} ${base - h * 0.7} Z`}
        fill={g.castle}
      />
      <Rect x={x - w * 0.9} y={base - h * 0.5} width={w * 0.8} height={h * 0.5} fill={g.castle} />
      <Rect x={x + w / 2 - 1.5 * scale} y={base - h * 0.62} width={3 * scale} height={5 * scale} rx={1} fill={g.gold} opacity={0.9} />
    </React.Fragment>
  );
}

// The enchanted night, for the whole Color Territory screen and its rules dialogs: a violet sky with
// a moon and stars, far hills with castles, and a few motes of light drifting up (still with
// reduce-motion). The orbs have their own glow, so this stays calm and keeps the play area clear.
export function EnchantedBackground({ children }: Props) {
  const { width, height } = useWindowDimensions();
  const drift = useRef(new Animated.Value(0)).current;
  const reduceRef = useRef(false);

  useEffect(() => {
    let alive = true;
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        reduceRef.current = v;
        if (!alive || v) return;
        loop = Animated.loop(Animated.timing(drift, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true }));
        loop.start();
      })
      .catch(() => {});
    return () => {
      alive = false;
      loop?.stop();
    };
  }, [drift]);

  const stars = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 46 }, () => ({ x: r() * 100, y: r() * 62, s: 1 + r() * 1.6, o: 0.25 + r() * 0.6 }));
  }, []);
  const motes = useMemo(() => {
    const r = rng(311);
    return Array.from({ length: 12 }, () => ({ x: 4 + r() * 92, y: 20 + r() * 70, s: 3 + r() * 4, phase: r() }));
  }, []);

  if (TERRITORY_BG_IMAGE) {
    return (
      <ImageBackground source={TERRITORY_BG_IMAGE} resizeMode="cover" style={styles.root}>
        {children}
      </ImageBackground>
    );
  }

  const base = height * 0.9;
  return (
    <View style={styles.root}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={g.sky1} />
            <Stop offset="0.35" stopColor={g.sky2} />
            <Stop offset="0.65" stopColor={g.sky3} />
            <Stop offset="0.85" stopColor={g.sky4} />
            <Stop offset="1" stopColor={g.sky5} />
          </LinearGradient>
          <RadialGradient id="moon" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={g.moonGlow} stopOpacity="0.5" />
            <Stop offset="1" stopColor={g.moonGlow} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#sky)" />
        <Circle cx={width * 0.84} cy={height * 0.11} r={width * 0.3} fill="url(#moon)" />
        <Circle cx={width * 0.84} cy={height * 0.11} r={Math.max(14, width * 0.045)} fill={g.moon} opacity={0.92} />
        {stars.map((s, i) => (
          <Circle key={i} cx={(s.x / 100) * width} cy={(s.y / 100) * height} r={s.s / 2} fill="#FFFFFF" opacity={s.o} />
        ))}
        {/* far hills and their castles */}
        <Path
          d={`M0 ${base - 40} Q${width * 0.22} ${base - 96} ${width * 0.45} ${base - 52} T${width} ${base - 70} L${width} ${height} L0 ${height} Z`}
          fill={g.hillFar}
        />
        {castle(width * 0.12, base - 44, 0.9)}
        {castle(width * 0.7, base - 66, 0.7)}
        <Path
          d={`M0 ${base + 6} Q${width * 0.3} ${base - 30} ${width * 0.6} ${base + 8} T${width} ${base - 6} L${width} ${height} L0 ${height} Z`}
          fill={g.hillNear}
        />
      </Svg>
      {motes.map((m, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${m.x}%`,
            top: `${m.y}%`,
            width: m.s,
            height: m.s,
            borderRadius: m.s,
            backgroundColor: g.gold,
            opacity: drift.interpolate({ inputRange: [0, m.phase, Math.min(1, m.phase + 0.3), 1], outputRange: [0.15, 0.15, 0.85, 0.15], extrapolate: 'clamp' }),
            transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -34 - m.s * 4] }) }],
          }}
        />
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: g.sky1 },
});
