import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, View } from 'react-native';
import { washitsu as w } from '../gameThemes/karutaTheme';

const H = 85;

// A glass wind chime (furin) with its paper strip, swaying gently. It does not move when the phone
// has reduce-motion turned on.
export function Furin({ scale = 1 }: { scale?: number }) {
  const sway = useRef(new Animated.Value(0)).current;
  const [still, setStill] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
  }, []);
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 1900, useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 2300, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [still, sway]);

  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] });

  return (
    <View pointerEvents="none" accessible={false} style={{ width: 34 * scale, height: H * scale, alignItems: 'center' }}>
      {/* the pivot is the top of the string, not the middle */}
      <Animated.View
        style={{
          width: 34,
          height: H,
          alignItems: 'center',
          transform: [{ scale }, { translateY: -H / 2 }, { rotate }, { translateY: H / 2 }],
        }}
      >
        <View style={{ width: 8, height: 4, borderRadius: 2, backgroundColor: w.wood }} />
        <View style={{ width: 1.5, height: 12, backgroundColor: w.wood }} />
        <View style={{ width: 26, height: 18, borderTopLeftRadius: 13, borderTopRightRadius: 13, backgroundColor: w.glass, borderWidth: 1.5, borderColor: w.glassEdge, alignItems: 'center', justifyContent: 'flex-end' }}>
          <View style={{ width: 4, height: 4, borderRadius: 4, backgroundColor: w.glassEdge, marginBottom: -2 }} />
        </View>
        <View style={{ width: 30, height: 3, borderRadius: 2, backgroundColor: w.glassEdge }} />
        <View style={{ width: 1, height: 14, backgroundColor: w.glassEdge }} />
        <View style={{ width: 10, height: 30, backgroundColor: w.paper, borderWidth: 1, borderColor: w.paperEdge }}>
          <View style={{ height: 6, backgroundColor: w.vermilion }} />
        </View>
      </Animated.View>
    </View>
  );
}
