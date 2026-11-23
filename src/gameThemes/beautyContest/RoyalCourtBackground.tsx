import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { royal as r, ROYAL_BG_IMAGE } from './theme';

type Props = { children?: React.ReactNode };

const MARBLE = [r.marble1, r.marble2, r.marble3, r.marble4, r.marble5];

// Small deterministic pseudo-random so the court looks the same on every render.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// A gothic pillar: a black shaft with gold flutes, a gold capital and a gold base.
function Pillar({ side, offset }: { side: 'left' | 'right'; offset: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, [side]: offset, width: 22, alignItems: 'center' }}>
      <View style={{ width: 28, height: 8, backgroundColor: r.goldDeep, opacity: 0.55 }} />
      <View style={{ width: 22, height: 5, backgroundColor: r.gold, opacity: 0.4 }} />
      <View style={{ flex: 1, width: 16, backgroundColor: r.marble4, borderLeftWidth: 1, borderRightWidth: 1, borderColor: r.goldDeep, opacity: 0.8 }}>
        <View style={{ flex: 1, marginHorizontal: 4, borderLeftWidth: 1, borderRightWidth: 1, borderColor: r.gold, opacity: 0.16 }} />
      </View>
      <View style={{ width: 22, height: 5, backgroundColor: r.gold, opacity: 0.4 }} />
      <View style={{ width: 28, height: 8, backgroundColor: r.goldDeep, opacity: 0.55 }} />
    </View>
  );
}

// The pointed arches that crown the court, a row of them across the top.
function Arches() {
  return (
    <View pointerEvents="none" style={styles.arches}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.arch}>
          <View style={styles.archInner} />
        </View>
      ))}
    </View>
  );
}

// The court of the Judgment of Numbers, for the whole Beauty Contest screen and its rules dialogs:
// black marble with faint veins, pillars at the sides, arches overhead, a cold spotlight from the
// ceiling on the middle of the floor, huge ghost numbers and holographic scan lines (a bright line
// sweeps down, not with reduce-motion). The edges are darker than the middle.
export function RoyalCourtBackground({ children }: Props) {
  const [still, setStill] = useState(false);
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
  }, []);
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 7000, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [still, sweep]);

  const veins = useMemo(() => {
    const rnd = rng(17);
    return Array.from({ length: 12 }, () => ({
      x: Math.round(rnd() * 100),
      y: Math.round(rnd() * 100),
      w: 120 + Math.round(rnd() * 200),
      rot: Math.round(rnd() * 120 - 60),
      gold: rnd() < 0.3,
    }));
  }, []);

  if (ROYAL_BG_IMAGE) {
    return (
      <ImageBackground source={ROYAL_BG_IMAGE} resizeMode="cover" style={styles.root}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,5,7,0.4)' }]} />
        {children}
      </ImageBackground>
    );
  }

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {MARBLE.map((col, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: col }} />
        ))}
      </View>

      {/* marble veins */}
      {veins.map((v, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{ position: 'absolute', left: `${v.x}%`, top: `${v.y}%`, width: v.w, height: 1, backgroundColor: v.gold ? r.gold : r.vein, opacity: v.gold ? 0.1 : 0.35, transform: [{ rotate: `${v.rot}deg` }] }}
        />
      ))}

      <Arches />

      {/* the spotlight on the judgment throne: a cone that widens towards the floor */}
      <View pointerEvents="none" style={styles.spotWrap}>
        <View style={styles.spot} />
      </View>

      {/* ghost numbers of the court */}
      <Text pointerEvents="none" style={[styles.ghost, { top: '22%', left: -10, transform: [{ rotate: '-8deg' }] }]}>
        100
      </Text>
      <Text pointerEvents="none" style={[styles.ghost, { top: '60%', right: -6, fontSize: 170, transform: [{ rotate: '6deg' }] }]}>
        0.8
      </Text>

      <Pillar side="left" offset={4} />
      <Pillar side="right" offset={4} />

      {/* holographic scan lines and the sweeping beam */}
      {Array.from({ length: 16 }, (_, i) => (
        <View key={i} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: `${i * 6.4}%`, height: 1, backgroundColor: r.holo, opacity: 0.04 }} />
      ))}
      {!still && (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, backgroundColor: r.holo, opacity: 0.12, transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [0, 900] }) }] }}
        />
      )}

      {/* a gold line along the floor */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 14, height: 2, backgroundColor: r.gold, opacity: 0.25 }} />

      {/* the dark closes in at the sides */}
      {[0, 1, 2, 3].map((i) => (
        <View key={`l${i}`} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: i * 14, width: 14, backgroundColor: `rgba(0,0,0,${0.5 - i * 0.12})` }} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <View key={`r${i}`} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, right: i * 14, width: 14, backgroundColor: `rgba(0,0,0,${0.5 - i * 0.12})` }} />
      ))}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: r.marble1, overflow: 'hidden' },
  arches: { position: 'absolute', top: -20, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around' },
  arch: { width: 92, height: 120, borderTopLeftRadius: 46, borderTopRightRadius: 46, borderWidth: 2, borderBottomWidth: 0, borderColor: r.gold, opacity: 0.22, alignItems: 'center' },
  archInner: { marginTop: 10, width: 72, height: 110, borderTopLeftRadius: 36, borderTopRightRadius: 36, borderWidth: 1, borderBottomWidth: 0, borderColor: r.goldDeep },
  spotWrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  spot: {
    width: 0,
    height: 0,
    borderLeftWidth: 190,
    borderRightWidth: 190,
    borderBottomWidth: 620,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(79,227,255,0.045)',
  },
  ghost: { position: 'absolute', color: r.gold, opacity: 0.05, fontSize: 150, fontWeight: '900' },
});
