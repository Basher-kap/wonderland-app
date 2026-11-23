import React, { memo, useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { FONT_DISPLAY, glade as g } from './theme';
import type { Kingdom } from './theme';

type Props = {
  size: number;
  kingdom: Kingdom | null; // null = a white pearl nobody owns
  mine: boolean; // owned by me: a gold ring, so I can find my own orbs
  onPress?: () => void;
  disabled?: boolean;
  still: boolean; // reduce motion: no pop, no ripple
  shimmer: Animated.Value; // one shared 0..1 loop that gently breathes the white pearls
  label: string;
};

// A circle of the glade. White = an untouched pearl (a soft breathing glow). Claimed = a glowing
// orb in its kingdom's colour with the kingdom's rune; when the owner changes the orb pops once and a
// ring of light spreads from it. Memoised: only the orbs that changed redraw while the clock ticks.
function OrbBase({ size, kingdom, mine, onPress, disabled, still, shimmer, label }: Props) {
  const pop = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const last = useRef<string | null>(kingdom ? kingdom.name : null);

  useEffect(() => {
    const now = kingdom ? kingdom.name : null;
    if (now === last.current) return;
    last.current = now;
    if (still || !now) return;
    pop.setValue(0.78);
    ring.setValue(0);
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 190, useNativeDriver: true }),
      Animated.timing(ring, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [kingdom, still, pop, ring]);

  const halo = size * 1.5;
  const rune = Math.round(size * 0.4);
  const breathe = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.34] });
  const spread = ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.45] });
  const spreadOpacity = ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.7, 0] });

  return (
    <Pressable
      onPressIn={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      {/* the glow */}
      {kingdom ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', width: halo, height: halo, borderRadius: halo, backgroundColor: kingdom.color, opacity: 0.3 }}
        />
      ) : (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', width: halo, height: halo, borderRadius: halo, backgroundColor: g.pearlGlow, opacity: breathe }}
        />
      )}

      {/* the ring that spreads when an orb is claimed */}
      {kingdom && !still && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size,
            borderWidth: 2,
            borderColor: kingdom.light,
            opacity: spreadOpacity,
            transform: [{ scale: spread }],
          }}
        />
      )}

      {/* the orb */}
      <Animated.View
        style={[
          styles.body,
          {
            width: size,
            height: size,
            borderRadius: size,
            backgroundColor: kingdom ? kingdom.color : g.pearl,
            borderColor: kingdom ? kingdom.deep : g.pearlShade,
            transform: [{ scale: pop }],
          },
          mine && { borderColor: g.gold },
        ]}
      >
        {/* the lit side and the shine */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: size * 0.08,
            left: size * 0.1,
            width: size * 0.62,
            height: size * 0.5,
            borderRadius: size,
            backgroundColor: kingdom ? kingdom.light : '#FFFFFF',
            opacity: kingdom ? 0.4 : 0.7,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: size * 0.14,
            left: size * 0.2,
            width: size * 0.16,
            height: size * 0.1,
            borderRadius: size,
            backgroundColor: '#FFFFFF',
            opacity: 0.9,
          }}
        />
        {kingdom && (
          <Text
            allowFontScaling={false}
            style={{ fontFamily: FONT_DISPLAY, fontSize: rune, lineHeight: rune + 2, color: '#FFFFFF', opacity: 0.85, marginTop: size * 0.06 }}
          >
            {kingdom.rune}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

export const Orb = memo(OrbBase);

const styles = StyleSheet.create({
  body: { borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
