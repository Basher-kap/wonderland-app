import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useReduceMotion } from '../../components/ui/useReduceMotion';
import { seance } from './theme';

type Props = { left: number | string; bottom: number; height?: number; seed?: number };

// A candle in a small brass dish. The flame sways and flickers and the glow around it breathes; with
// "reduce motion" on, it just burns steadily. Every candle gets its own `seed` so they never flicker in step.
export function Candle({ left, bottom, height = 30, seed = 0 }: Props) {
  const reduce = useReduceMotion();
  const sway = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) return;
    const a = 380 + seed * 70;
    const b = 520 + seed * 90;
    const flame = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: a, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: -0.6, duration: b, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0.4, duration: a * 0.7, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const breath = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: b + 200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: a + 300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    flame.start();
    breath.start();
    return () => {
      flame.stop();
      breath.stop();
    };
  }, [reduce, seed, sway, glow]);

  const scaleY = sway.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.86, 1, 1.14] });
  const shiftX = sway.interpolate({ inputRange: [-1, 0, 1], outputRange: [-1.5, 0, 1.5] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });

  return (
    <View pointerEvents="none" style={[styles.root, { left: left as any, bottom }]}>
      <Animated.View style={[styles.glowOuter, { bottom: height + 2, opacity: glowOpacity }]} />
      <Animated.View style={[styles.glowInner, { bottom: height + 8, opacity: glowOpacity }]} />
      <Animated.View style={[styles.flame, { bottom: height + 5, transform: [{ translateX: shiftX }, { scaleY }] }]}>
        <View style={styles.core} />
      </Animated.View>
      <View style={styles.wick} />
      <View style={[styles.body, { height }]}>
        <View style={styles.drip} />
      </View>
      <View style={styles.dish} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', width: 34, alignItems: 'center', marginLeft: -17 },
  glowOuter: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: seance.glow, marginBottom: -60 },
  glowInner: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,190,100,0.25)', marginBottom: -28 },
  flame: { position: 'absolute', width: 10, height: 18, borderRadius: 6, borderBottomLeftRadius: 5, borderBottomRightRadius: 5, backgroundColor: seance.flame, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  core: { width: 4, height: 9, borderRadius: 3, backgroundColor: seance.flameCore },
  wick: { position: 'absolute', bottom: 0, width: 1.5, height: 0, backgroundColor: seance.ink },
  body: { width: 14, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: seance.wax, borderRightWidth: 3, borderRightColor: seance.waxShade },
  drip: { position: 'absolute', top: 0, left: 2, width: 4, height: 9, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: seance.wax },
  dish: { width: 32, height: 6, borderRadius: 3, backgroundColor: seance.brass, borderTopWidth: 1, borderTopColor: '#D1B15C' },
});
