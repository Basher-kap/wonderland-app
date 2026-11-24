import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { FONT_SHOW, show } from './theme';

// A "telop": the big outlined caption of a Japanese variety show. React Native has no text stroke,
// so the outline is the same text drawn four times, nudged in four directions, under the real one.
export function Telop(props: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  outline?: string;
  width?: number; // outline thickness
  align?: 'left' | 'center' | 'right';
  lines?: number;
  style?: StyleProp<TextStyle>;
}) {
  const { children, size = 22, color = show.white, outline = show.ink, width = 2, align = 'center', lines, style } = props;
  const base: TextStyle = { fontFamily: FONT_SHOW, fontSize: size, lineHeight: Math.round(size * 1.18), textAlign: align, fontWeight: '900' };
  const copies: [number, number][] = [
    [-width, -width],
    [width, -width],
    [-width, width],
    [width, width],
    [0, width + 1],
  ];
  return (
    <View>
      {copies.map(([dx, dy], i) => (
        <Text
          key={i}
          numberOfLines={lines}
          style={[base, style, { color: outline, position: 'absolute', left: dx, right: -dx, top: dy }]}
          allowFontScaling={false}
        >
          {children}
        </Text>
      ))}
      <Text numberOfLines={lines} style={[base, style, { color }]} allowFontScaling={false}>
        {children}
      </Text>
    </View>
  );
}

// A comic sound caption that bangs onto the screen and fades away, every time `k` changes.
export function SfxPop({ text, color, k, still }: { text: string; color: string; k: number; still: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (k === 0) return;
    v.setValue(0);
    if (still) {
      Animated.sequence([Animated.timing(v, { toValue: 0.5, duration: 1, useNativeDriver: true }), Animated.delay(900), Animated.timing(v, { toValue: 1, duration: 200, useNativeDriver: true })]).start();
      return;
    }
    Animated.timing(v, { toValue: 1, duration: 1300, easing: Easing.linear, useNativeDriver: true }).start();
  }, [k, still, v]);
  if (k === 0) return null;
  const scale = still ? 1 : v.interpolate({ inputRange: [0, 0.12, 0.22, 0.8, 1], outputRange: [0.2, 1.35, 1, 1, 0.9] });
  const opacity = v.interpolate({ inputRange: [0, 0.05, 0.75, 1], outputRange: [0, 1, 1, 0] });
  const rotate = v.interpolate({ inputRange: [0, 0.12, 0.22, 1], outputRange: ['-18deg', '-4deg', '-8deg', '-8deg'] });
  return (
    <Animated.View pointerEvents="none" style={[styles.pop, { opacity, transform: [{ scale }, { rotate }] }]}>
      <Telop size={38} color={color} outline={show.ink} width={3}>
        {text}
      </Telop>
    </Animated.View>
  );
}

const CONFETTI_COLORS = [show.pink, show.yellow, show.cyan, show.lime, show.orange, show.purple];

// Confetti falling over the whole screen, every time `k` changes.
export function Confetti({ k, still }: { k: number; still: boolean }) {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        x: ((i * 37) % 100) / 100,
        size: 7 + ((i * 13) % 8),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: (i * 53) % 600,
        spin: 1 + (i % 3),
        v: new Animated.Value(0),
      })),
    []
  );
  useEffect(() => {
    if (k === 0 || still) return;
    pieces.forEach((p) => {
      p.v.setValue(0);
      Animated.timing(p.v, { toValue: 1, duration: 2600, delay: p.delay, easing: Easing.in(Easing.quad), useNativeDriver: true }).start();
    });
  }, [k, still, pieces]);
  if (k === 0 || still) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x * width,
            top: -20,
            width: p.size,
            height: p.size * 0.5,
            backgroundColor: p.color,
            opacity: p.v.interpolate({ inputRange: [0, 0.05, 0.9, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.9] }) },
              { translateX: p.v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, (i % 2 ? 24 : -24), 0] }) },
              { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${360 * p.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pop: { position: 'absolute', top: '22%', left: 0, right: 0, alignItems: 'center', zIndex: 20 },
});
