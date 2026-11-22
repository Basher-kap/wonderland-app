import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../../navigation';
import { space } from '../../theme';
import { useReduceMotion } from '../ui';

// TEMPORARY tutorial for new players. A speech bubble under the "Hi, player_xxxxxxxx" greeting on Home,
// pointing up at the name, asking them to pick their own username. It shows only while the username is
// still the automatic one (player_ + 8 hex characters, see ensureProfile in lib/api.ts), so it disappears
// by itself as soon as the player saves a new name. "Got it" hides it until the app is opened again.
// To remove the tutorial: delete this file and its two lines in HomeScreen.tsx.
const AUTO_NAME = /^player_([0-9a-f]{8}|demo)$/;

// The arrow must sit under the name: the logo is 46 wide plus a 10 gap (see HomeScreen `brand`).
const ARROW_LEFT = 46 + 10 + 22;

export function UsernameTutorialBubble({ username }: { username: string }) {
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const reduceMotion = useReduceMotion();
  const [dismissed, setDismissed] = useState(false);
  const float = useRef(new Animated.Value(0)).current;

  const visible = !dismissed && AUTO_NAME.test(username);

  // A slow up-and-down float draws the eye to the bubble. Off when the phone asks to reduce motion.
  useEffect(() => {
    if (!visible || reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, reduceMotion, float]);

  if (!visible) return null;

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, 4] });

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY }] }]}>
      <View style={styles.arrow} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create your username. Opens Settings."
        onPress={() => navigation.navigate('Settings')}
        style={styles.bubble}
      >
        <Text style={styles.title}>Create your username!</Text>
        <Text style={styles.body}>
          This is a temporary name. Tap here to open Settings and pick the name other players will see.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss tip"
          onPress={() => setDismissed(true)}
          hitSlop={10}
          style={styles.dismiss}
        >
          <Text style={styles.dismissText}>Got it</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: -8, marginBottom: 18 },
  // A square turned 45 degrees; only its top and left edges are drawn, so it reads as the bubble's tip.
  arrow: {
    marginLeft: ARROW_LEFT,
    width: 14,
    height: 14,
    marginBottom: -7,
    zIndex: 1,
    transform: [{ rotate: '45deg' }],
    backgroundColor: '#0B1220',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: space.iceLine,
  },
  bubble: {
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: space.iceLine,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  title: { color: space.ice, fontSize: 16, fontWeight: '700' },
  body: { color: space.text, fontSize: 14, lineHeight: 20 },
  dismiss: { alignSelf: 'flex-end', paddingVertical: 2 },
  dismissText: { color: space.textDim, fontSize: 13, fontWeight: '600' },
});
