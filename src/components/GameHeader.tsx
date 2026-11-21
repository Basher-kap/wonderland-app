import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import SpaceBackground from './SpaceBackground';
import { useReduceMotion } from './useReduceMotion';
import { space } from '../spaceTheme';

const BAR = 58;

/**
 * The header of the Game screen: a strip of real night sky. Pure black, stars that twinkle, a shooting star
 * now and then, and a thread of light that runs along the bottom edge. The back arrow and the forfeit
 * buttons (set by GameScreen through navigation.setOptions) keep working: this only draws them.
 */
export function GameHeader({ navigation, options, back, route }: NativeStackHeaderProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const height = BAR + insets.top;
  const title = typeof options.title === 'string' ? options.title : route.name;
  // The game sets its own icon (headerLeft) and name (title). Without them the header falls back to a back arrow.
  const left = options.headerLeft?.({ canGoBack: !!back, tintColor: space.text });
  const showBack = !left && !!back && options.headerBackVisible !== false;
  const right = options.headerRight?.({ canGoBack: !!back, tintColor: space.text });

  return (
    <View style={{ height, backgroundColor: space.void }}>
      <SpaceBackground size={{ width, height }} density={0.2} heroes={2} style={StyleSheet.absoluteFill}>
        <View style={[styles.row, { paddingTop: insets.top }]}>
          {showBack && (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => [styles.back, pressed && { backgroundColor: space.pressedBg }]}
            >
              <MaterialCommunityIcons name="chevron-left" size={28} color={space.text} />
            </Pressable>
          )}
          {left ? <View style={styles.badge}>{left}</View> : null}
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          <View style={{ flex: 1 }} />
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
        <Thread width={width} />
      </SpaceBackground>
    </View>
  );
}

// A hairline along the bottom edge, with a short bright light that travels along it every few seconds.
function Thread({ width }: { width: number }) {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(3400),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, t]);
  const len = Math.min(180, width * 0.5);
  return (
    <View pointerEvents="none" style={styles.thread}>
      {!reduce && (
        <Animated.View
          style={{
            width: len,
            height: 1.5,
            opacity: t.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 1, 1, 0] }),
            transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-len, width] }) }],
          }}
        >
          <Svg width={len} height={1.5}>
            <Defs>
              <LinearGradient id="gh-thread" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFD596" stopOpacity="0" />
                <Stop offset="0.85" stopColor="#FFD596" stopOpacity="0.95" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={len} height={1.5} fill="url(#gh-thread)" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8, paddingRight: 12 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: space.lineStrong,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  title: { color: space.text, fontSize: 18, fontWeight: '600', letterSpacing: 0.3, flexShrink: 1 },
  right: { flexShrink: 0 },
  thread: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1.5,
    backgroundColor: space.line,
    overflow: 'hidden',
  },
});
