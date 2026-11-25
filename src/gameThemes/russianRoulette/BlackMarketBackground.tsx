import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { den } from './theme';

// The den, behind the whole game and the rules dialogs: a brick wall in the dark, the silhouettes of other
// gamblers, two dim industrial lamps swinging on their cords, smoke drifting through the room, a worn wooden
// table with metal studs, and a heavy vignette. (With reduce-motion the lamps and the smoke stand still.)
// The middle stays dark and calm so the revolver is the one thing the eye goes to.

// A far gambler: shoulders, head and (sometimes) a hat, in black.
function Figure({ x, y, s, hat }: { x: number; y: number; s: number; hat: boolean }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Path d="M-30 70 Q-28 36 0 32 Q28 36 30 70 Z" fill="#050304" />
      <Circle cx={0} cy={14} r={14} fill="#050304" />
      {hat && <Path d="M-22 6 L22 6 L16 -2 Q0 -12 -16 -2 Z" fill="#050304" />}
      <Path d="M-14 8 Q0 -2 14 8" stroke={den.goldDim} strokeWidth={1} fill="none" opacity={0.5} />
    </G>
  );
}

export function BlackMarketBackground({ children }: { children?: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const swing = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    let loops: Animated.CompositeAnimation[] = [];
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (!alive || reduce) return;
        loops = [
          Animated.loop(
            Animated.sequence([
              Animated.timing(swing, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
              Animated.timing(swing, { toValue: 0, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ])
          ),
          Animated.loop(Animated.timing(drift, { toValue: 1, duration: 26000, easing: Easing.linear, useNativeDriver: true })),
        ];
        loops.forEach((l) => l.start());
      })
      .catch(() => {});
    return () => {
      alive = false;
      loops.forEach((l) => l.stop());
    };
  }, [swing, drift]);

  const bricks = useMemo(() => {
    const rowH = 30;
    const brickW = 64;
    let d = '';
    for (let r = 0; r * rowH < height; r++) {
      const y = r * rowH;
      d += `M0 ${y} H${width} `;
      const off = r % 2 ? brickW / 2 : 0;
      for (let x = -off; x < width; x += brickW) d += `M${x} ${y} V${y + rowH} `;
    }
    return d;
  }, [width, height]);

  const tableY = height * 0.8;
  const smoke = useMemo(
    () => [
      { y: 0.18, s: 260, o: 0.05, p: 0 },
      { y: 0.42, s: 340, o: 0.045, p: 0.35 },
      { y: 0.62, s: 300, o: 0.05, p: 0.7 },
    ],
    []
  );

  const lamp = (cx: number, len: number, phase: 1 | -1) => (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: cx - 90,
        width: 180,
        height: len + 220,
        transformOrigin: '50% 0%',
        transform: [{ rotate: swing.interpolate({ inputRange: [0, 1], outputRange: [`${2.2 * phase}deg`, `${-2.2 * phase}deg`] }) }],
      }}
    >
      <Svg width={180} height={len + 220} viewBox={`0 0 180 ${len + 220}`}>
        <Defs>
          <RadialGradient id={`glow${phase}`} cx="0.5" cy="0.25" r="0.75">
            <Stop offset="0" stopColor="#E8B655" stopOpacity="0.34" />
            <Stop offset="1" stopColor="#E8B655" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Path d={`M90 ${len + 14} L10 ${len + 220} L170 ${len + 220} Z`} fill={`url(#glow${phase})`} />
        <Rect x={89} y={0} width={2} height={len} fill={den.steelDark} />
        <Path d={`M62 ${len + 18} Q90 ${len - 10} 118 ${len + 18} Z`} fill="#1E1A16" stroke={den.steel} strokeWidth={2} />
        <Rect x={58} y={len + 16} width={64} height={5} rx={2} fill={den.steel} />
        <Circle cx={90} cy={len + 26} r={7} fill="#F1C766" opacity={0.95} />
      </Svg>
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0C0706" />
            <Stop offset="1" stopColor={den.wall} />
          </LinearGradient>
          <LinearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={den.woodLight} />
            <Stop offset="0.12" stopColor={den.wood} />
            <Stop offset="1" stopColor={den.woodDark} />
          </LinearGradient>
          <RadialGradient id="vignette" cx="0.5" cy="0.45" r="0.75">
            <Stop offset="0.35" stopColor="#000000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.88" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#wall)" />
        <Path d={bricks} stroke={den.mortar} strokeWidth={2} opacity={0.9} />
        {/* the other gamblers, far back */}
        <Figure x={width * 0.1} y={tableY - 118} s={0.9} hat />
        <Figure x={width * 0.9} y={tableY - 124} s={0.95} hat={false} />
        <Figure x={width * 0.5} y={tableY - 98} s={0.7} hat />
        {/* metal plates in the top corners */}
        {[0, 1].map((i) => (
          <G key={i}>
            <Rect x={i ? width - 46 : 0} y={0} width={46} height={46} fill={den.steelDark} stroke={den.steel} strokeWidth={1.5} opacity={0.85} />
            {[8, 38].map((a) => [8, 38].map((b) => <Circle key={`${a}${b}`} cx={(i ? width - 46 : 0) + a} cy={b} r={2.5} fill={den.steelLight} />))}
          </G>
        ))}
        {/* the worn wooden table */}
        <Rect x={0} y={tableY} width={width} height={height - tableY} fill="url(#wood)" />
        <Rect x={0} y={tableY} width={width} height={4} fill={den.goldDim} opacity={0.7} />
        {[0.14, 0.31, 0.5, 0.69, 0.86].map((f) => (
          <Rect key={f} x={width * f} y={tableY + 4} width={2} height={height - tableY} fill={den.woodDark} />
        ))}
        {[0.08, 0.27, 0.46, 0.63, 0.8, 0.93].map((f, i) => (
          <Path key={f} d={`M${width * f} ${tableY + 18 + i * 9} q ${width * 0.07} -4 ${width * 0.14} 0`} stroke={den.woodDark} strokeWidth={1.5} fill="none" opacity={0.8} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <Circle key={i} cx={(width * (i + 0.5)) / 9} cy={tableY + 12} r={2.2} fill={den.steel} />
        ))}
        {/* the dark */}
        <Rect x={0} y={0} width={width} height={height} fill="url(#vignette)" />
      </Svg>

      {lamp(width * 0.22, 40, 1)}
      {lamp(width * 0.78, 70, -1)}

      {/* smoke */}
      {smoke.map((m, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: height * m.y,
            left: -m.s,
            width: m.s,
            height: m.s * 0.45,
            borderRadius: m.s,
            backgroundColor: `rgba(200,190,175,${m.o})`,
            transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [(width + m.s) * m.p, (width + m.s) * (m.p + 1)] }) }],
          }}
        />
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: den.black },
});
