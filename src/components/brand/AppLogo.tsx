import React from 'react';
import { Image, Text, View } from 'react-native';
import { space } from '../../theme';

type Props = { size?: number; wordmark?: boolean; tagline?: boolean };

/**
 * The logo of Wonderland: the grinning cat in a ring of violet light (assets/splash-icon.png).
 * The picture's black is "screened" away and its edge is rounded, so the ring floats on the night sky
 * and the stars behind it are not covered by a square.
 */
export function AppLogo({ size = 160, wordmark = false, tagline = false }: Props) {
  return (
    <View style={{ alignItems: 'center' }} accessible accessibilityRole="image" accessibilityLabel="Wonderland">
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        <Image
          source={require('../../../assets/splash-icon.png')}
          resizeMode="cover"
          style={{ width: size, height: size, mixBlendMode: 'screen' }}
        />
      </View>
      {wordmark && (
        <Text
          style={{
            color: space.text,
            fontSize: Math.max(22, size * 0.2),
            fontWeight: '600',
            letterSpacing: 1,
            marginTop: 4,
          }}
        >
          Wonderland
        </Text>
      )}
      {tagline && (
        <Text style={{ color: space.textDim, fontSize: 13, marginTop: 4 }}>Logic · Experience · Chance</Text>
      )}
    </View>
  );
}
