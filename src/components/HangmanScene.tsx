import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { west } from '../gameThemes/hangmanTheme';

// The Hangman picture, in two layers that are laid over each other:
//   <Skyline>       the sky, the setting sun, the mesas and the desert; as wide as the screen
//   <GallowsScene>  the stage, the gallows, the cactus and the outlaw; drawn on a 320 x 210 grid
// Every size on the grid is multiplied by `u` (grid units to pixels), so the whole picture
// shrinks to fit the space it is given and never needs a scroll.

export const GRID_W = 320;
export const GRID_H = 210;

type RectProps = { u: number; x: number; y: number; w: number; h: number; color?: string; r?: number; style?: ViewStyle };
function R({ u, x, y, w, h, color, r = 0, style }: RectProps) {
  return (
    <View
      pointerEvents="none"
      style={[{ position: 'absolute', left: x * u, top: y * u, width: w * u, height: h * u, backgroundColor: color, borderRadius: r * u }, style]}
    />
  );
}

// A straight bar from (x1, y1) to (x2, y2): the brace, the arms and the legs.
function L({ u, x1, y1, x2, y2, t, color }: { u: number; x1: number; y1: number; x2: number; y2: number; t: number; color: string }) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: (cx - len / 2) * u,
        top: (cy - t / 2) * u,
        width: len * u,
        height: t * u,
        backgroundColor: color,
        borderRadius: (t / 2) * u,
        transform: [{ rotate: `${deg}deg` }],
      }}
    />
  );
}

// ---- the sky ---------------------------------------------------------------------------------

export function Skyline({ sceneW, u, boxLeft }: { sceneW: number; u: number; boxLeft: number }) {
  const sunR = 52 * u;
  const leftMesaW = Math.max(0, boxLeft + 58 * u);
  const rightMesaW = Math.max(0, sceneW - (boxLeft + 262 * u));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {west.sky.map((c, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: c }} />
      ))}
      {/* the sun sits right behind the gallows, so the outlaw is a dark shape on a bright disc */}
      <View
        style={{
          position: 'absolute',
          left: boxLeft + 190 * u - sunR * 1.25,
          bottom: (GRID_H - 112) * u - sunR * 1.25,
          width: sunR * 2.5,
          height: sunR * 2.5,
          borderRadius: sunR * 1.25,
          backgroundColor: west.sun,
          opacity: 0.22,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: boxLeft + 190 * u - sunR,
          bottom: (GRID_H - 112) * u - sunR,
          width: sunR * 2,
          height: sunR * 2,
          borderRadius: sunR,
          backgroundColor: west.sun,
        }}
      />
      <View style={{ position: 'absolute', left: 0, bottom: 14 * u, width: leftMesaW, height: 68 * u, backgroundColor: west.mesaFar, borderTopRightRadius: 4 * u }} />
      <View style={{ position: 'absolute', left: 0, bottom: 14 * u, width: Math.max(0, leftMesaW - 22 * u), height: 82 * u, backgroundColor: west.mesaFar, borderTopRightRadius: 4 * u }} />
      <View style={{ position: 'absolute', right: 0, bottom: 14 * u, width: rightMesaW, height: 56 * u, backgroundColor: west.mesaNear, borderTopLeftRadius: 4 * u }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 14 * u, height: 40 * u, backgroundColor: west.ridge }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 14 * u, backgroundColor: west.sand }} />
    </View>
  );
}

// ---- the gallows -----------------------------------------------------------------------------

// `parts` 0-6 = how many parts of the outlaw are drawn. `open` = the trapdoor has opened.
export function GallowsScene({ u, parts, open }: { u: number; parts: number; open: boolean }) {
  const drop = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    Animated.timing(drop, {
      toValue: open ? 1 : 0,
      duration: reduceMotion ? 0 : 520,
      easing: Easing.out(Easing.back(1.6)),
      useNativeDriver: false, // the rope changes its height
    }).start();
  }, [open, reduceMotion, drop]);

  const FALL = 24; // how far the outlaw drops through the trapdoor (grid units)
  const ROPE = 56; // the rope, from the beam to the knot
  const ink = west.ink;
  const ropeHeight = drop.interpolate({ inputRange: [0, 1], outputRange: [ROPE * u, (ROPE + FALL) * u] });
  const fallY = drop.interpolate({ inputRange: [0, 1], outputRange: [0, FALL * u] });
  const leftLeaf = drop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '85deg'] });
  const rightLeaf = drop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-85deg'] });
  const CX = 190; // the rope, and the middle of the outlaw

  return (
    <View style={{ width: GRID_W * u, height: GRID_H * u }} pointerEvents="none">
      {/* a cactus, left of the stage */}
      <R u={u} x={24} y={150} w={8} h={46} color={west.cactus} r={4} />
      <R u={u} x={14} y={164} w={10} h={5} color={west.cactus} r={2} />
      <R u={u} x={14} y={154} w={5} h={15} color={west.cactus} r={2.5} />
      <R u={u} x={32} y={170} w={9} h={5} color={west.cactus} r={2} />
      <R u={u} x={36} y={160} w={5} h={15} color={west.cactus} r={2.5} />

      {/* under the stage: shadow, posts and a cross plank */}
      <R u={u} x={64} y={158} w={192} h={38} color="rgba(20,8,12,0.55)" />
      <R u={u} x={70} y={158} w={8} h={38} color={west.woodDark} />
      <R u={u} x={242} y={158} w={8} h={38} color={west.woodDark} />
      <R u={u} x={64} y={181} w={192} h={5} color={west.woodDark} />

      {/* the gallows */}
      <R u={u} x={96} y={144} w={17} h={6} color={west.woodDark} />
      <R u={u} x={100} y={24} w={9} h={126} color={west.wood} />
      <R u={u} x={100} y={24} w={98} h={8} color={west.wood} />
      <R u={u} x={100} y={24} w={98} h={2} color={west.woodLight} />
      <L u={u} x1={109} y1={62} x2={140} y2={32} t={6} color={west.woodDark} />

      {/* the rope, behind the outlaw */}
      <Animated.View
        style={{ position: 'absolute', left: (CX - 1.2) * u, top: 32 * u, width: 2.4 * u, height: ropeHeight, backgroundColor: west.hemp }}
      />
      <R u={u} x={CX - 3} y={30} w={6} h={6} color={west.hemp} r={3} />

      {/* the outlaw: head, body, arms, legs, in that order */}
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: GRID_W * u, height: GRID_H * u, transform: [{ translateY: fallY }] }}>
        {parts >= 2 && <L u={u} x1={CX} y1={92} x2={CX} y2={122} t={4} color={ink} />}
        {parts >= 3 && <L u={u} x1={CX} y1={100} x2={CX - 17} y2={118} t={3.5} color={ink} />}
        {parts >= 4 && <L u={u} x1={CX} y1={100} x2={CX + 17} y2={118} t={3.5} color={ink} />}
        {parts >= 5 && <L u={u} x1={CX} y1={122} x2={CX - 12} y2={150} t={3.5} color={ink} />}
        {parts >= 6 && <L u={u} x1={CX} y1={122} x2={CX + 12} y2={150} t={3.5} color={ink} />}
        {parts >= 1 && (
          <>
            <R u={u} x={CX - 10} y={68} w={20} h={20} color={west.skin} r={10} style={{ borderWidth: 2 * u, borderColor: ink }} />
            {open ? (
              <Text
                style={{ position: 'absolute', left: (CX - 9) * u, top: 72 * u, width: 18 * u, textAlign: 'center', color: ink, fontSize: 11 * u, fontWeight: '900', includeFontPadding: false }}
              >
                ××
              </Text>
            ) : (
              <>
                <R u={u} x={CX - 6} y={76} w={3} h={3} color={ink} r={1.5} />
                <R u={u} x={CX + 3} y={76} w={3} h={3} color={ink} r={1.5} />
                <R u={u} x={CX - 4} y={83} w={8} h={2} color={ink} r={1} />
              </>
            )}
            {/* the hat */}
            <R u={u} x={CX - 8} y={54} w={16} h={13} color={west.hat} r={3} />
            <R u={u} x={CX - 8} y={61} w={16} h={3} color={west.hatBand} />
            <R u={u} x={CX - 17} y={65} w={34} h={5} color={west.hat} r={2.5} />
          </>
        )}
        {/* the noose around the neck */}
        <R u={u} x={CX - 9} y={87} w={18} h={8} color="transparent" r={9} style={{ borderWidth: 2.2 * u, borderColor: west.hemp }} />
      </Animated.View>

      {/* the stage deck, with the trapdoor in the middle of it */}
      <R u={u} x={64} y={150} w={106} h={8} color={west.wood} />
      <R u={u} x={210} y={150} w={46} h={8} color={west.wood} />
      <R u={u} x={64} y={150} w={106} h={2} color={west.woodLight} />
      <R u={u} x={210} y={150} w={46} h={2} color={west.woodLight} />
      {[84, 108, 132, 226, 242].map((x) => (
        <R key={x} u={u} x={x} y={152} w={1} h={6} color={west.woodDark} />
      ))}
      <Animated.View
        style={{
          position: 'absolute', left: 170 * u, top: 150 * u, width: 20 * u, height: 8 * u, backgroundColor: west.woodDark,
          transform: [{ translateX: -10 * u }, { rotate: leftLeaf }, { translateX: 10 * u }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute', left: 190 * u, top: 150 * u, width: 20 * u, height: 8 * u, backgroundColor: west.woodDark,
          transform: [{ translateX: 10 * u }, { rotate: rightLeaf }, { translateX: -10 * u }],
        }}
      />
    </View>
  );
}

// ---- the bullets: how many wrong guesses are left -------------------------------------------

export function Bullets({ left, total }: { left: number; total: number }) {
  return (
    <View style={bullets.row} accessible accessibilityLabel={`${left} wrong guesses left`}>
      {Array.from({ length: total }, (_, i) => {
        const live = i < left;
        return (
          <View key={i} style={[bullets.round, live ? bullets.live : bullets.spent]}>
            {live && <View style={bullets.tip} />}
          </View>
        );
      })}
    </View>
  );
}

const bullets = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, padding: 5, borderRadius: 8, backgroundColor: west.plate, alignSelf: 'flex-start' },
  round: { width: 9, height: 20, borderRadius: 3, overflow: 'hidden', justifyContent: 'flex-start' },
  live: { backgroundColor: west.brass },
  spent: { borderWidth: 1.5, borderColor: west.brassDark },
  tip: { height: 7, backgroundColor: '#B8683A', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
});

