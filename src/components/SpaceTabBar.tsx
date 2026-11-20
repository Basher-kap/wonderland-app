import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors } from '../theme';
import { space } from '../spaceTheme';

// One outline icon per tab, filled while it is the active tab. Unknown tab names get a dot.
const ICONS: Record<string, { off: string; on: string }> = {
  Home: { off: 'home-outline', on: 'home' },
  Leaderboard: { off: 'trophy-outline', on: 'trophy' },
  Settings: { off: 'tune-variant', on: 'tune-variant' },
};

/**
 * Nebula glass tab bar: a floating frosted pill, amber glow under the active tab.
 * Use it on the tab navigator:
 *   <Tab.Navigator tabBar={(props) => <SpaceTabBar {...props} />} ...>
 */
export function SpaceTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.strip, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;
          const icon = ICONS[route.name] ?? { off: 'circle-small', on: 'circle-small' };
          const color = focused ? colors.accent : colors.muted;

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
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.glow, focused && styles.glowOn]} />
              <MaterialCommunityIcons name={(focused ? icon.on : icon.off) as any} size={22} color={color} />
              <Text style={[styles.label, { color, fontWeight: focused ? '600' : '400' }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The strip behind the pill keeps the app's own background colour.
  strip: { backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 6 },
  pill: {
    flexDirection: 'row',
    height: 68,
    borderRadius: 26,
    backgroundColor: 'rgba(23, 20, 58, 0.92)',
    borderWidth: 1,
    borderColor: space.border,
    borderTopColor: space.borderTop,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 48 },
  glow: { width: 18, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  glowOn: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  label: { fontSize: 11 },
});