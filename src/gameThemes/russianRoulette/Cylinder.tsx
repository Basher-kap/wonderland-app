import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Stop } from 'react-native-svg';
import { CHAMBER_COUNT, den } from './theme';

// The revolver's six-chamber cylinder, the hero of the screen. Chamber 0 is under the hammer (the
// marker at the top). While loading you tap a chamber to put a bullet in it (or take it out again).
// `spinKey` going up spins it (fast, then slowing down); when it stops `onSpinEnd` is called and, with
// `closed`, a steel plate shuts over the chambers: nobody, not even the owner, can see which chamber
// stopped under the hammer.
const C = 100; // centre of the 200 x 200 drawing
const RING = 56; // distance of a chamber from the centre
const HOLE = 21;

const chamberPos = (i: number) => {
  const a = ((i * 360) / CHAMBER_COUNT - 90) * (Math.PI / 180);
  return { x: C + RING * Math.cos(a), y: C + RING * Math.sin(a) };
};

// One bullet (a brass cartridge seen from the front) at a point.
export function BulletFace({ x, y, r = 16, live = true }: { x: number; y: number; r?: number; live?: boolean }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={r} fill={den.brass} stroke="#7A5A1E" strokeWidth={1.5} />
      <Circle cx={x} cy={y} r={r * 0.72} fill="none" stroke="#8A6A2A" strokeWidth={1} />
      <Circle cx={x} cy={y} r={r * 0.38} fill={live ? den.copper : '#6B6B6B'} stroke="#5A3418" strokeWidth={1} />
      <Path d={`M${x - r * 0.6} ${y - r * 0.35} Q${x} ${y - r * 0.95} ${x + r * 0.6} ${y - r * 0.35}`} stroke="#F3E2AE" strokeWidth={1.5} fill="none" opacity={0.7} />
    </G>
  );
}

export function Cylinder(props: {
  size: number;
  loaded: boolean[]; // which chambers hold a bullet
  closed: boolean; // the plate is shut
  onChamber?: (i: number) => void;
  spinKey: number;
  onSpinEnd?: () => void;
  still: boolean; // reduce motion
  tense?: boolean; // the pulse before a shot
  dead?: boolean;
}) {
  const { size, loaded, closed, onChamber, spinKey, onSpinEnd, still, tense, dead } = props;
  const rot = useRef(new Animated.Value(0)).current;
  const deg = useRef(0);
  const plate = useRef(new Animated.Value(closed ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const lastKey = useRef(spinKey);
  const endRef = useRef(onSpinEnd);
  endRef.current = onSpinEnd;

  useEffect(() => {
    if (spinKey === lastKey.current) return;
    lastKey.current = spinKey;
    const to = deg.current + (still ? 90 : 1440 + Math.floor(Math.random() * 360));
    deg.current = to;
    Animated.timing(rot, { toValue: to, duration: still ? 250 : 2400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) endRef.current?.();
    });
  }, [spinKey, still, rot]);

  useEffect(() => {
    Animated.timing(plate, { toValue: closed ? 1 : 0, duration: still ? 1 : 350, useNativeDriver: true }).start();
  }, [closed, still, plate]);

  useEffect(() => {
    if (!tense || still) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 520, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [tense, still, pulse]);

  const spin = rot.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
  const beat = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

  return (
    <Animated.View style={{ width: size, height: size, opacity: dead ? 0.35 : 1, transform: [{ scale: beat }] }}>
      <Animated.View style={{ width: size, height: size, transform: [{ rotate: spin }] }}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id="steel" cx="0.4" cy="0.35" r="0.8">
              <Stop offset="0" stopColor={den.steelLight} />
              <Stop offset="0.55" stopColor={den.steel} />
              <Stop offset="1" stopColor={den.steelDark} />
            </RadialGradient>
          </Defs>
          <Circle cx={C} cy={C} r={95} fill="url(#steel)" stroke={den.black} strokeWidth={3} />
          <Circle cx={C} cy={C} r={88} fill="none" stroke={den.steelDark} strokeWidth={2} />
          {/* the flutes between the chambers */}
          {Array.from({ length: CHAMBER_COUNT }, (_, i) => {
            const a = (((i + 0.5) * 360) / CHAMBER_COUNT - 90) * (Math.PI / 180);
            return <Line key={i} x1={C + 80 * Math.cos(a)} y1={C + 80 * Math.sin(a)} x2={C + 92 * Math.cos(a)} y2={C + 92 * Math.sin(a)} stroke={den.black} strokeWidth={5} strokeLinecap="round" />;
          })}
          {Array.from({ length: CHAMBER_COUNT }, (_, i) => {
            const p = chamberPos(i);
            return (
              <G key={i}>
                <Circle cx={p.x} cy={p.y} r={HOLE} fill="#050303" stroke={den.steelLight} strokeWidth={2} />
                <Circle cx={p.x} cy={p.y} r={HOLE - 4} fill="#0E0908" />
                {loaded[i] && <BulletFace x={p.x} y={p.y} />}
                {!closed && onChamber && <Circle cx={p.x} cy={p.y} r={HOLE + 6} fill="transparent" onPress={() => onChamber(i)} />}
              </G>
            );
          })}
          <Circle cx={C} cy={C} r={13} fill={den.steelDark} stroke={den.steelLight} strokeWidth={2} />
          <Circle cx={C} cy={C} r={5} fill={den.black} />
        </Svg>
        {/* the steel plate that shuts over the chambers */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: plate }]}>
          <Svg width={size} height={size} viewBox="0 0 200 200">
            <Circle cx={C} cy={C} r={84} fill="#1B1D21" stroke={den.gold} strokeWidth={3} />
            <Circle cx={C} cy={C} r={70} fill="none" stroke={den.steelDark} strokeWidth={2} />
            {Array.from({ length: CHAMBER_COUNT }, (_, i) => {
              const p = chamberPos(i);
              return <Circle key={i} cx={p.x} cy={p.y} r={6} fill={den.steel} stroke={den.black} strokeWidth={1.5} />;
            })}
            <Circle cx={C} cy={C} r={16} fill={den.blood} stroke={den.gold} strokeWidth={2} />
            <Path d="M92 100 L108 100 M100 92 L100 108" stroke={den.gold} strokeWidth={2} />
          </Svg>
        </Animated.View>
      </Animated.View>
      {/* the hammer marker: the chamber under it is the one that fires */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center' }]}>
        <Svg width={size * 0.14} height={size * 0.12} viewBox="0 0 28 24" style={{ marginTop: -size * 0.04 }}>
          <Path d="M2 2 L26 2 L14 22 Z" fill={den.bloodBright} stroke={den.black} strokeWidth={2} />
        </Svg>
      </View>
    </Animated.View>
  );
}
