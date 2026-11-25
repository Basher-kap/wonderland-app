import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

// The jumpscare. One flash of light (never a strobe), a shake of the whole screen, and for a player who
// has just been shot: a glimpse of the gunshot light that fades away and leaves the screen black.

// The muzzle flash: white, then red, then gone. With reduce-motion it is one soft red glow instead.
export function GunFlash({ k, still }: { k: number; still: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (k === 0) return;
    v.setValue(0);
    if (still) {
      Animated.sequence([
        Animated.timing(v, { toValue: 0.5, duration: 200, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
      return;
    }
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 40, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.55, duration: 110, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [k, still, v]);
  if (k === 0) return null;
  const white = still ? 0 : v.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 0, 1] });
  const red = v.interpolate({ inputRange: [0, 0.55, 1], outputRange: still ? [0, 0.35, 0.35] : [0, 0.45, 0.6] });
  return (
    <>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#FFF6E0', opacity: white, zIndex: 40 }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#B3121A', opacity: red, zIndex: 39 }]} />
    </>
  );
}

// Shakes everything inside for a moment, every time `k` changes.
export function Shake({ k, still, children }: { k: number; still: boolean; children: React.ReactNode }) {
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (k === 0 || still) return;
    const hit = (to: number, ms: number) => Animated.timing(x, { toValue: to, duration: ms, useNativeDriver: true });
    const hitY = (to: number, ms: number) => Animated.timing(y, { toValue: to, duration: ms, useNativeDriver: true });
    Animated.parallel([
      Animated.sequence([hit(-14, 40), hit(12, 50), hit(-9, 50), hit(6, 50), hit(-3, 60), hit(0, 70)]),
      Animated.sequence([hitY(8, 40), hitY(-10, 50), hitY(6, 50), hitY(-3, 50), hitY(0, 60)]),
    ]).start();
  }, [k, still, x, y]);
  return <Animated.View style={{ flex: 1, transform: [{ translateX: x }, { translateY: y }] }}>{children}</Animated.View>;
}

// The screen of a player who is out: after a glimpse of the light it fades to black and stays black.
export function Blackout({ active, still, children }: { active: boolean; still: boolean; children?: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  const was = useRef(active);
  useEffect(() => {
    if (!active) {
      v.setValue(0);
      was.current = false;
      return;
    }
    if (was.current) {
      v.setValue(1); // already out when this screen opened
      return;
    }
    was.current = true;
    Animated.sequence([Animated.delay(still ? 0 : 500), Animated.timing(v, { toValue: 1, duration: still ? 300 : 1500, useNativeDriver: true })]).start();
  }, [active, still, v]);
  return (
    <Animated.View pointerEvents={active ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity: v, zIndex: 50, alignItems: 'center', justifyContent: 'center' }]}>
      {children}
    </Animated.View>
  );
}
