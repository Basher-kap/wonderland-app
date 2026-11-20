import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, ImageBackground, StyleSheet, View } from 'react-native';
import { cave as c, XIBALBA_BG_IMAGE } from '../gameThemes/xibalbaTheme';
import { MayaGlyph } from './MayaGlyph';
import type { GlyphKind } from './MayaGlyph';

type Props = { children?: React.ReactNode };

const DARK = [c.dark1, c.dark2, c.dark3, c.dark4, c.dark5];
const FRIEZE: GlyphKind[] = ['face', 'step', 'sun', 'cross', 'face', 'step', 'sun', 'cross', 'face'];

// Small deterministic pseudo-random so the cave stays the same on every render.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function Stalactite({ x, w, h, color }: { x: number; w: number; h: number; color: string }) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: `${x}%`, width: 0, height: 0, borderLeftWidth: w / 2, borderRightWidth: w / 2, borderTopWidth: h, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: color }}
    />
  );
}

function Stalagmite({ x, w, h }: { x: number; w: number; h: number }) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', bottom: 46, left: `${x}%`, width: 0, height: 0, borderLeftWidth: w / 2, borderRightWidth: w / 2, borderBottomWidth: h, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: c.rockB }}
    />
  );
}

// A wall torch: a flame that flickers (not with reduce-motion) and a pool of light on the wall.
function Torch({ side, top, still }: { side: 'left' | 'right'; top: number; still: boolean }) {
  const flick = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flick, { toValue: 0.72, duration: 380, useNativeDriver: true }),
        Animated.timing(flick, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(flick, { toValue: 0.86, duration: 330, useNativeDriver: true }),
        Animated.timing(flick, { toValue: 1, duration: 420, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [still, flick]);
  const pos = side === 'left' ? { left: 14 } : { right: 14 };
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', top, width: 16, alignItems: 'center' }, pos]}>
      <Animated.View style={{ position: 'absolute', top: -70, opacity: flick }}>
        {[170, 120, 70].map((d, i) => (
          <View key={i} style={{ position: 'absolute', left: 8 - d / 2, top: 80 - d / 2, width: d, height: d, borderRadius: d, backgroundColor: c.torch, opacity: 0.045 }} />
        ))}
      </Animated.View>
      <Animated.View style={{ opacity: flick, transform: [{ scaleY: flick }] }}>
        <View style={{ width: 14, height: 22, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 7, borderBottomRightRadius: 7, backgroundColor: c.torch, alignItems: 'center', justifyContent: 'flex-end' }}>
          <View style={{ width: 7, height: 11, borderRadius: 5, backgroundColor: c.torchSoft }} />
        </View>
      </Animated.View>
      <View style={{ width: 6, height: 30, backgroundColor: c.rockEdge }} />
      <View style={{ width: 16, height: 5, borderRadius: 2, backgroundColor: c.stoneHi }} />
    </View>
  );
}

// A far-off stepped pyramid with a jade-lit doorway.
function Pyramid() {
  const steps = [56, 92, 130, 170, 210];
  return (
    <View pointerEvents="none" style={styles.pyramid}>
      <View style={{ position: 'absolute', top: -34, width: 110, height: 110, borderRadius: 110, backgroundColor: c.jade, opacity: 0.06 }} />
      <View style={{ width: 28, height: 20, backgroundColor: c.rockA, alignItems: 'center', justifyContent: 'flex-end' }}>
        <View style={{ width: 10, height: 13, backgroundColor: c.jade, opacity: 0.9 }} />
      </View>
      {steps.map((w) => (
        <View key={w} style={{ width: w, height: 16, backgroundColor: c.rockA, borderTopWidth: 2, borderTopColor: c.rockEdge }} />
      ))}
    </View>
  );
}

// The cave, for the whole Xibalba screen and its rules dialogs: darkness, stalactites, a carved
// frieze, two wall torches, mist, and a pyramid far away. The edges are darker than the middle.
export function CaveBackground({ children }: Props) {
  const [still, setStill] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
  }, []);

  const sparks = useMemo(() => {
    const r = rng(23);
    return Array.from({ length: 22 }, (_, i) => ({ x: Math.round(r() * 96), y: Math.round(10 + r() * 70), o: 0.25 + r() * 0.35, jade: i % 3 === 0 }));
  }, []);
  const cracks = useMemo(() => {
    const r = rng(9);
    return Array.from({ length: 7 }, () => ({ x: Math.round(r() * 90), w: 20 + Math.round(r() * 40) }));
  }, []);

  if (XIBALBA_BG_IMAGE) {
    return (
      <ImageBackground source={XIBALBA_BG_IMAGE} resizeMode="cover" style={styles.root}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(2,6,7,0.4)' }]} />
        {children}
      </ImageBackground>
    );
  }

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {DARK.map((col, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: col }} />
        ))}
      </View>

      {/* embers and jade wisps floating in the dark */}
      {sparks.map((s, i) => (
        <View key={i} pointerEvents="none" style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, width: 3, height: 3, borderRadius: 3, backgroundColor: s.jade ? c.jade : c.torch, opacity: s.o }} />
      ))}

      <Pyramid />

      {/* ceiling */}
      <View pointerEvents="none" style={styles.ceiling} />
      {[0, 9, 17, 26, 37, 48, 58, 69, 78, 88, 96].map((x, i) => (
        <Stalactite key={x} x={x} w={22 + (i % 3) * 10} h={26 + ((i * 17) % 40)} color={i % 2 ? c.rockA : c.rockB} />
      ))}

      {/* the carved frieze */}
      <View pointerEvents="none" style={styles.frieze}>
        {FRIEZE.map((k, i) => (
          <MayaGlyph key={i} kind={k} size={26} color={c.glyph} />
        ))}
      </View>

      <Torch side="left" top={230} still={still} />
      <Torch side="right" top={300} still={still} />

      {/* floor, mist and stalagmites */}
      <View pointerEvents="none" style={styles.ground}>
        {cracks.map((k, i) => (
          <View key={i} style={{ position: 'absolute', left: `${k.x}%`, top: 8 + (i % 3) * 11, width: k.w, height: 1.5, backgroundColor: c.jade, opacity: 0.18 }} />
        ))}
      </View>
      <Stalagmite x={4} w={34} h={46} />
      <Stalagmite x={13} w={22} h={28} />
      <Stalagmite x={84} w={30} h={40} />
      <Stalagmite x={93} w={20} h={24} />
      {[0.12, 0.3, 0.55].map((l, i) => (
        <View key={i} pointerEvents="none" style={{ position: 'absolute', bottom: 40 + i * 10, left: `${l * 100 - 20}%`, width: 220, height: 26, borderRadius: 26, backgroundColor: c.jade, opacity: 0.04 }} />
      ))}

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
  root: { flex: 1, backgroundColor: c.dark1, overflow: 'hidden' },
  ceiling: { position: 'absolute', top: 0, left: 0, right: 0, height: 14, backgroundColor: c.rockA },
  frieze: { position: 'absolute', top: 70, left: 18, right: 18, flexDirection: 'row', justifyContent: 'space-between', opacity: 0.3 },
  pyramid: { position: 'absolute', bottom: 46, alignSelf: 'center', alignItems: 'center', opacity: 0.8 },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 46, backgroundColor: '#0A1213', borderTopWidth: 2, borderTopColor: c.rockEdge },
});
