import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { space } from '../spaceTheme';

// One outline icon per tab; the active one is filled. A tab with an unknown name gets a plain dot.
const ICONS: Record<string, { off: string; on: string }> = {
  Home: { off: 'home-outline', on: 'home' },
  Leaderboard: { off: 'trophy-outline', on: 'trophy' },
  Settings: { off: 'cog-outline', on: 'cog' },
};

/**
 * The tab bar of the main pages: a floating pill of black glass on the night sky.
 * The active tab is lit amber and has a small four-point star above it.
 * The strip around the pill is see-through, so the sky continues behind it (see MainTabs in App.tsx).
 */
export function SpaceTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.strip, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;
          const icon = ICONS[route.name] ?? { off: 'circle-small', on: 'circle-small' };
          const color = focused ? space.amber : space.textDim;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={({ pressed }) => [styles.item, pressed && { backgroundColor: space.pressedBg }]}
            >
              <View style={styles.starSlot}>
                {focused && <MaterialCommunityIcons name="star-four-points" size={9} color={space.amber} style={styles.star} />}
              </View>
              <MaterialCommunityIcons name={(focused ? icon.on : icon.off) as 'home'} size={22} color={color} />
              <Text style={[styles.label, { color, fontWeight: focused ? '600' : '400' }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { paddingHorizontal: 16, paddingTop: 6, backgroundColor: 'transparent' },
  pill: {
    flexDirection: 'row',
    height: 66,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(3, 4, 9, 0.86)',
    borderWidth: 1,
    borderColor: space.line,
    borderTopColor: space.rim,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 48 },
  starSlot: { height: 9, justifyContent: 'center' },
  star: {
    textShadowColor: space.amber,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  label: { fontSize: 11 },
});