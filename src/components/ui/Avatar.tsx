import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useAvatar } from '../../lib/avatars';
import { space } from '../../theme';

type Props = {
  /** The player's uid. Without it (or without a picture) the first letter of the name is shown. */
  uid?: string | null;
  name?: string;
  size?: number;
  style?: ViewStyle;
};

/** A round profile picture, or a circle with the first letter of the name when there is none. */
export function Avatar({ uid, name = '', size = 32, style }: Props) {
  const uri = useAvatar(uid);
  const box = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[styles.box, box, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {uri ? (
        <Image source={{ uri }} style={box} />
      ) : (
        <Text style={[styles.letter, { fontSize: Math.max(10, Math.round(size * 0.44)) }]}>
          {name.trim().slice(0, 1).toUpperCase() || '?'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' },
  letter: { color: space.text, fontWeight: '700' },
});
