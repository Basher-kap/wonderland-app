import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, ImageBackground, StyleSheet, View } from 'react-native';
import { stage as s, PIANO_BG_IMAGE } from './theme';

type Props = { children?: React.ReactNode };

const NIGHT = [s.black1, s.black2, s.black3, s.black4, s.black5];

// Small deterministic pseudo-random so the hall looks the same on every render.
function rng(seed: number) {
  let n = seed;
  return () => {
    n = (n * 1664525 + 1013904223) % 4294967296;
    return n / 4294967296;
  };
}

// A chandelier hanging from the vault: a gold chain, three tiers of lights and a halo around each
// light that breathes slowly (`glow` runs between dim and bright).
function Chandelier({ left, scale, glow }: { left: string; scale: number; glow: Animated.Value }) {
  const tiers = [
    { y: 0, n: 3, gap: 16 },
    { y: 20, n: 5, gap: 17 },
    { y: 40, n: 7, gap: 17 },
  ];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: left as never, alignItems: 'center', transform: [{ scale }] }}>
      <View style={{ width: 2, height: 54, backgroundColor: s.gold, opacity: 0.55 }} />
      <View style={{ width: 130, height: 76, alignItems: 'center' }}>
        {tiers.map((t, ti) => (
          <View key={ti} style={{ position: 'absolute', top: t.y, flexDirection: 'row', gap: t.gap - 7 }}>
            {Array.from({ length: t.n }, (_, i) => (
              <View key={i} style={{ width: 7, height: 7, alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View style={{ position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(242,199,92,0.22)', opacity: glow }} />
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: s.goldBright }} />
              </View>
            ))}
          </View>
        ))}
        <View style={{ position: 'absolute', top: 14, width: 56, height: 2, backgroundColor: s.gold, opacity: 0.6 }} />
        <View style={{ position: 'absolute', top: 34, width: 88, height: 2, backgroundColor: s.gold, opacity: 0.6 }} />
        <View style={{ position: 'absolute', top: 54, width: 120, height: 3, backgroundColor: s.gold, opacity: 0.7 }} />
      </View>
    </View>
  );
}

// A note that drifts upward through the hall and fades, again and again.
function DriftingNote({ x, y, size, delay, dur, glyph, gold, still }: { x: number; y: number; size: number; delay: number; dur: number; glyph: string; gold: boolean; still: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true })])
    );
    loop.start();
    return () => loop.stop();
  }, [still, delay, dur, v]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -170] });
  const translateX = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 16, -8] });
  const opacity = v.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 0.5, 0.35, 0] });
  return (
    <Animated.Text
      pointerEvents="none"
      style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, fontSize: size, color: gold ? s.gold : s.violetSoft, opacity: still ? 0.22 : opacity, transform: [{ translateY }, { translateX }] }}
    >
      {glyph}
    </Animated.Text>
  );
}

// A pillar of the hall: a pale violet shaft with a gold capital and base.
function Pillar({ side, offset }: { side: 'left' | 'right'; offset: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, [side]: offset, width: 22, alignItems: 'center' }}>
      <View style={{ width: 28, height: 8, backgroundColor: s.goldDeep, opacity: 0.6 }} />
      <View style={{ width: 22, height: 5, backgroundColor: s.gold, opacity: 0.45 }} />
      <View style={{ flex: 1, width: 16, backgroundColor: s.black4, borderLeftWidth: 1, borderRightWidth: 1, borderColor: s.violet, opacity: 0.75 }}>
        <View style={{ flex: 1, marginHorizontal: 4, borderLeftWidth: 1, borderRightWidth: 1, borderColor: s.violetSoft, opacity: 0.25 }} />
      </View>
      <View style={{ width: 22, height: 5, backgroundColor: s.gold, opacity: 0.45 }} />
      <View style={{ width: 28, height: 8, backgroundColor: s.goldDeep, opacity: 0.6 }} />
    </View>
  );
}

// The Enchanted Symphony hall, for the whole Piano Tiles screen and its rules dialogs: a deep blue
// vault of pointed arches, two glowing chandeliers, pillars at the sides, stars, and notes drifting
// upward. The lights breathe and the notes drift unless the phone asks for reduced motion. The
// edges are darker than the middle.
export function SymphonyBackground({ children }: Props) {
  const [still, setStill] = useState(false);
  const glow = useRef(new Animated.Value(1)).current;
  const twinkle = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
  }, []);
  useEffect(() => {
    if (still) return;
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.5, duration: 1500, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 1700, useNativeDriver: true }),
      ])
    );
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { toValue: 0.25, duration: 1900, useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 1, duration: 2300, useNativeDriver: true }),
      ])
    );
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [still, glow, twinkle]);

  const stars = useMemo(() => {
    const r = rng(23);
    return Array.from({ length: 56 }, (_, i) => ({ x: Math.round(r() * 98), y: Math.round(r() * 96), z: r() < 0.15 ? 3 : 2, o: 0.2 + r() * 0.5, blink: i % 3 === 0 }));
  }, []);
  const notes = useMemo(() => {
    const r = rng(5);
    const glyphs = ['♪', '♫', '♩', '♬'];
    return Array.from({ length: 9 }, (_, i) => ({
      x: 6 + Math.round(r() * 84),
      y: 40 + Math.round(r() * 50),
      size: 16 + Math.round(r() * 14),
      delay: Math.round(r() * 6000),
      dur: 7000 + Math.round(r() * 5000),
      glyph: glyphs[i % glyphs.length],
      gold: i % 2 === 0,
    }));
  }, []);

  if (PIANO_BG_IMAGE) {
    return (
      <ImageBackground source={PIANO_BG_IMAGE} resizeMode="cover" style={styles.root}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,7,25,0.4)' }]} />
        {children}
      </ImageBackground>
    );
  }

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {NIGHT.map((col, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: col }} />
        ))}
      </View>

      {/* violet light pooling on the stage and drifting in the vault */}
      <View pointerEvents="none" style={{ position: 'absolute', top: '25%', left: -100, width: 300, height: 300, borderRadius: 300, backgroundColor: s.violet, opacity: 0.1 }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: '55%', right: -120, width: 320, height: 320, borderRadius: 320, backgroundColor: s.blue, opacity: 0.08 }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: -90, left: '12%', width: 280, height: 210, borderRadius: 210, backgroundColor: s.violet, opacity: 0.14 }} />

      {/* stars */}
      {stars.map((st, i) => {
        const dot = <View style={{ width: st.z, height: st.z, borderRadius: st.z, backgroundColor: s.ivory, opacity: st.o }} />;
        return st.blink ? (
          <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', left: `${st.x}%`, top: `${st.y}%`, opacity: twinkle }}>
            {dot}
          </Animated.View>
        ) : (
          <View key={i} pointerEvents="none" style={{ position: 'absolute', left: `${st.x}%`, top: `${st.y}%` }}>
            {dot}
          </View>
        );
      })}

      {/* the vault: pointed arches in gold line */}
      <View pointerEvents="none" style={styles.arches}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.arch}>
            <View style={styles.archInner} />
          </View>
        ))}
      </View>

      <Chandelier left="16%" scale={0.8} glow={glow} />
      <Chandelier left="58%" scale={0.8} glow={glow} />

      <Pillar side="left" offset={4} />
      <Pillar side="right" offset={4} />

      {/* the notes drifting upward */}
      {notes.map((n, i) => (
        <DriftingNote key={i} {...n} still={still} />
      ))}

      {/* a gold line along the stage */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 14, height: 2, backgroundColor: s.gold, opacity: 0.3 }} />

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
  root: { flex: 1, backgroundColor: s.black1, overflow: 'hidden' },
  arches: { position: 'absolute', top: -24, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around' },
  arch: { width: 120, height: 130, borderTopLeftRadius: 60, borderTopRightRadius: 60, borderWidth: 2, borderBottomWidth: 0, borderColor: s.gold, opacity: 0.2, alignItems: 'center' },
  archInner: { marginTop: 10, width: 96, height: 120, borderTopLeftRadius: 48, borderTopRightRadius: 48, borderWidth: 1, borderBottomWidth: 0, borderColor: s.violetSoft },
});