import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { space, typo } from '../../theme';

/**
 * The header of a main page that is not a tab (the Lobby). It sits on the sky instead of in a bar,
 * so the stars run behind it. Put the page's SafeAreaView (top edge) around it.
 */
export function SpaceHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <View style={styles.row}>
      {onBack && (
        <Pressable
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.back, pressed && { backgroundColor: space.pressedBg }]}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={space.text} />
        </Pressable>
      )}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 56, paddingLeft: 8, paddingRight: 150 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { ...typo.heading, fontSize: 20 },
});