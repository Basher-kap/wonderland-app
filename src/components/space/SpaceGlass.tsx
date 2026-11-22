import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SpaceBackground } from './SpaceBackground';
import { useReduceMotion } from '../ui';
import { space } from '../../theme';

/**
 * A box of black glass with its own little piece of night sky inside: stars that twinkle, and a thin
 * band of light that sweeps across it once when it appears.
 * tone 'amber' is for the moment that matters (the answer at the end of a game).
 * Used by the frame around the games (GameScreen). The games themselves do not use it.
 */
export function StarGlass({
  children,
  style,
  contentStyle,
  tone = 'ice',
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  tone?: 'ice' | 'amber';
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    // Only a real change (more than 8px) rebuilds the stars, so a growing text does not shuffle them.
    setBox((b) => (Math.abs(b.width - width) > 8 || Math.abs(b.height - height) > 8 ? { width, height } : b));
  };
  const amber = tone === 'amber';
  return (
    <View
      onLayout={onLayout}
      style={[styles.glass, amber ? styles.glassAmber : styles.glassIce, style]}
    >
      {box.width > 0 && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: 0.85 }]}>
          <SpaceBackground size={box} density={Math.min(0.5, (box.width * box.height) / 140000)} heroes={1} meteor={false} />
        </View>
      )}
      {box.width > 0 && <Sweep width={box.width} height={box.height} color={amber ? '#FFD596' : '#BFD3FF'} />}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

// One slanted band of light that crosses the box once, a moment after it appears.
function Sweep({ width, height, color }: { width: number; height: number; color: string }) {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const a = Animated.timing(t, { toValue: 1, duration: 1100, delay: 350, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [reduce, t]);
  if (reduce) return null;
  const band = Math.max(60, width * 0.28);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -height * 0.5,
        left: 0,
        width: band,
        height: height * 2,
        opacity: t.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-band, width + band] }) },
          { rotate: '18deg' },
        ],
      }}
    >
      <Svg width={band} height={height * 2}>
        <Defs>
          <LinearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity="0" />
            <Stop offset="0.5" stopColor={color} stopOpacity="0.2" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={band} height={height * 2} fill="url(#sweep)" />
      </Svg>
    </Animated.View>
  );
}

/**
 * The 3-2-1 before a game: each number drops in from close up, with a ring of light that spreads out
 * and a handful of sparks that fly away from it, like a star going nova.
 */
export function WarpCountdown({ value }: { value: number }) {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      t.setValue(1);
      return;
    }
    t.setValue(0);
    const a = Animated.timing(t, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [value, reduce, t]);

  const num = {
    opacity: t.interpolate({ inputRange: [0, 0.2], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ scale: t.interpolate({ inputRange: [0, 0.35, 1], outputRange: [2.4, 1, 1] }) }],
  };
  const ring = {
    opacity: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.9, 0] }),
    transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.8] }) }],
  };
  const sparks = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 + value;
    const far = 62 + (i % 3) * 14;
    return {
      key: i,
      style: {
        opacity: t.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 0.4, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * far] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * far] }) },
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1.4, 0.3] }) },
        ],
      },
    };
  });

  return (
    <View style={cd.wrap} accessible accessibilityRole="timer" accessibilityLabel={String(value)}>
      {!reduce && <Animated.View style={[cd.ring, ring]} />}
      {!reduce && sparks.map((s) => <Animated.View key={s.key} style={[cd.spark, s.style]} />)}
      <Animated.Text style={[cd.num, num]}>{value}</Animated.Text>
    </View>
  );
}

// A small four-point star that pulses: used beside the title of the end-of-game answer.
export function Glint({ size = 12, color = space.amber }: { size?: number; color?: string }) {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0.35, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, t]);
  return (
    <Animated.View style={{ opacity: t, transform: [{ scale: t.interpolate({ inputRange: [0.35, 1], outputRange: [0.8, 1.25] }) }] }}>
      <MaterialCommunityIcons name="star-four-points" size={size} color={color} />
    </Animated.View>
  );
}

export function GlintTitle({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.glintRow}>
      <Glint size={10} />
      <Text style={styles.glintText}>{children}</Text>
      <Glint size={10} />
    </View>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.86)',
  },
  glassIce: { borderColor: space.line, borderTopColor: space.rim },
  glassAmber: {
    borderColor: space.amberLine,
    borderTopColor: space.amber,
    shadowColor: space.amber,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  content: { padding: 14, gap: 4 },
  glintRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  glintText: { color: space.textDim, fontSize: 14, fontWeight: '600' },
});

const cd = StyleSheet.create({
  wrap: { height: 150, alignItems: 'center', justifyContent: 'center' },
  num: {
    color: space.text,
    fontSize: 84,
    fontWeight: '800',
    textShadowColor: space.amber,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
  ring: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: space.amber,
  },
  spark: { position: 'absolute', width: 3, height: 3, borderRadius: 2, backgroundColor: '#FFE9C2' },
});
