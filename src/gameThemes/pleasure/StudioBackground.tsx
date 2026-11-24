import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { show } from './theme';

// The TV studio, behind the whole game and the rules dialogs: a violet set with red curtains at the
// sides, a checkered stage floor, sweeping coloured spotlights and a strip of blinking LED lights.
// (With reduce-motion the lights stand still.) The play area itself stays calm and uncluttered.
const BEAMS = [
  { x: 0.16, color: show.pink, w: 150, phase: 0 },
  { x: 0.5, color: show.cyan, w: 170, phase: 0.33 },
  { x: 0.84, color: show.yellow, w: 150, phase: 0.66 },
];

export function StudioBackground({ children }: { children?: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const sway = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    let loops: Animated.CompositeAnimation[] = [];
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (!alive || reduce) return;
        loops = [
          Animated.loop(
            Animated.sequence([
              Animated.timing(sway, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
              Animated.timing(sway, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ])
          ),
          Animated.loop(
            Animated.sequence([
              Animated.timing(blink, { toValue: 1, duration: 450, easing: Easing.linear, useNativeDriver: true }),
              Animated.timing(blink, { toValue: 0, duration: 450, easing: Easing.linear, useNativeDriver: true }),
            ])
          ),
        ];
        loops.forEach((l) => l.start());
      })
      .catch(() => {});
    return () => {
      alive = false;
      loops.forEach((l) => l.stop());
    };
  }, [sway, blink]);

  const bulbs = useMemo(() => Array.from({ length: 16 }, (_, i) => i), []);
  const floorY = height * 0.84;
  const curtainW = Math.max(26, width * 0.08);

  return (
    <View style={styles.root}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="set" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={show.night} />
            <Stop offset="0.7" stopColor={show.night2} />
            <Stop offset="1" stopColor="#3B1A8C" />
          </LinearGradient>
          <RadialGradient id="glow" cx="0.5" cy="0.45" r="0.6">
            <Stop offset="0" stopColor={show.pink} stopOpacity="0.28" />
            <Stop offset="1" stopColor={show.pink} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#set)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#glow)" />
        {/* the checkered stage floor */}
        <Rect x={0} y={floorY} width={width} height={height - floorY} fill="#2A1166" />
        {[0, 1].map((r) =>
          [0, 1, 2, 3, 4, 5].map((c) => (
            <Rect
              key={`${r}${c}`}
              x={(c * width) / 6}
              y={floorY + (r * (height - floorY)) / 2}
              width={width / 6}
              height={(height - floorY) / 2}
              fill={(r + c) % 2 === 0 ? '#3A1A8A' : '#4A25A8'}
              opacity={0.8}
            />
          ))
        )}
        {/* the red curtains */}
        <Rect x={0} y={0} width={curtainW} height={height} fill={show.curtain} />
        <Rect x={width - curtainW} y={0} width={curtainW} height={height} fill={show.curtain} />
        {[0.25, 0.55, 0.85].map((f) => (
          <Rect key={`l${f}`} x={curtainW * f} y={0} width={3} height={height} fill={show.curtainDark} />
        ))}
        {[0.25, 0.55, 0.85].map((f) => (
          <Rect key={`r${f}`} x={width - curtainW * (1 - f)} y={0} width={3} height={height} fill={show.curtainDark} />
        ))}
        {/* sparkles */}
        {[0.12, 0.3, 0.47, 0.66, 0.9].map((f, i) => (
          <Circle key={i} cx={width * f} cy={height * (0.1 + ((i * 7) % 5) * 0.05)} r={1.8} fill="#FFFFFF" opacity={0.6} />
        ))}
      </Svg>

      {/* the spotlights */}
      {BEAMS.map((b, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: width * b.x - b.w / 2,
            width: 0,
            height: 0,
            borderLeftWidth: b.w / 2,
            borderRightWidth: b.w / 2,
            borderBottomWidth: height * 0.72,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: b.color,
            opacity: 0.13,
            transformOrigin: '50% 0%',
            transform: [{ rotate: sway.interpolate({ inputRange: [0, 1], outputRange: [i % 2 ? '16deg' : '-16deg', i % 2 ? '-16deg' : '16deg'] }) }],
          }}
        />
      ))}

      {/* the blinking LED strip along the top */}
      <View pointerEvents="none" style={styles.leds}>
        {bulbs.map((i) => (
          <Animated.View
            key={i}
            style={[
              styles.bulb,
              { backgroundColor: [show.pink, show.yellow, show.cyan, show.lime][i % 4], opacity: i % 2 === 0 ? blink : blink.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] }) },
            ]}
          />
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: show.night },
  leds: { position: 'absolute', top: 4, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-evenly' },
  bulb: { width: 7, height: 7, borderRadius: 7 },
});
