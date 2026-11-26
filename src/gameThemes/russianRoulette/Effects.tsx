import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { FONT_DEN, shieldColors } from './theme';

// The jumpscare. One flash of light (never a strobe), a shake of the whole screen, and for a player who
// has just been shot: a glimpse of the gunshot light that fades away and leaves the screen black.

// ---------------------------------------------------------------- the shield force ----
// A blue-green force field over the whole screen for a player who is protected: a faint hexagonal lattice,
// glowing edges, a scan line sweeping down, and a ripple spreading from the centre every time `k` changes
// (a bullet deflected, or the shield switching on). It is the only cool colour in the den.
const HEX = 26;

function hexPath(width: number, height: number): string {
  const w = Math.sqrt(3) * HEX;
  let d = '';
  for (let row = 0, y = 0; y < height + HEX; row++, y += HEX * 1.5) {
    for (let x = row % 2 ? w / 2 : 0; x < width + w; x += w) {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i - 30);
        d += `${i === 0 ? 'M' : 'L'}${(x + HEX * Math.cos(a)).toFixed(1)} ${(y + HEX * Math.sin(a)).toFixed(1)} `;
      }
      d += 'Z ';
    }
  }
  return d;
}

export function ShieldField({ on, k, still }: { on: boolean; k: number; still: boolean }) {
  const { width, height } = useWindowDimensions();
  const fade = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const lattice = useMemo(() => hexPath(width, height), [width, height]);

  useEffect(() => {
    Animated.timing(fade, { toValue: on ? 1 : 0, duration: still ? 1 : 350, useNativeDriver: true }).start();
  }, [on, still, fade]);

  useEffect(() => {
    if (k === 0) return;
    ring.setValue(0);
    Animated.timing(ring, { toValue: 1, duration: still ? 1 : 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [k, still, ring]);

  useEffect(() => {
    if (!on || still) return;
    sweep.setValue(0);
    const loop = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [on, still, sweep]);

  const d = Math.min(width, height) * 0.5;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: fade, zIndex: 38 }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="shieldField" cx="0.5" cy="0.5" r="0.75">
            <Stop offset="0.45" stopColor={shieldColors.teal} stopOpacity="0.04" />
            <Stop offset="1" stopColor={shieldColors.blue} stopOpacity="0.5" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#shieldField)" />
        <Path d={lattice} stroke={shieldColors.teal} strokeWidth={1} fill="none" opacity={0.2} />
        <Rect x={4} y={4} width={width - 8} height={height - 8} rx={22} fill="none" stroke={shieldColors.teal} strokeWidth={4} opacity={0.85} />
        <Rect x={11} y={11} width={width - 22} height={height - 22} rx={17} fill="none" stroke={shieldColors.blue} strokeWidth={1.5} opacity={0.55} />
      </Svg>
      {!still && (
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 70,
            backgroundColor: 'rgba(25,240,210,0.09)',
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: 'rgba(25,240,210,0.35)',
            transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [-70, height] }) }],
          }}
        />
      )}
      <Animated.View
        style={{
          position: 'absolute',
          left: width / 2 - d / 2,
          top: height / 2 - d / 2,
          width: d,
          height: d,
          borderRadius: d,
          borderWidth: 4,
          borderColor: shieldColors.teal,
          backgroundColor: 'rgba(25,240,210,0.08)',
          opacity: ring.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.9, 0] }),
          transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.8] }) }],
        }}
      />
      <View style={styles.shieldBadge}>
        <Text style={styles.shieldText}>SHIELD FORCE</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shieldBadge: {
    position: 'absolute',
    bottom: 96,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: shieldColors.teal,
    backgroundColor: 'rgba(6,69,79,0.75)',
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 3,
  },
  shieldText: { color: shieldColors.text, fontFamily: FONT_DEN, fontSize: 14, letterSpacing: 4 },
});

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
