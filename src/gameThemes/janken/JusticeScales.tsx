import React from 'react';
import { View } from 'react-native';

// The scales of justice, drawn with plain views (no image needed): a post, a beam, two chains and
// two pans. Used above the judges' bench and at the top of the rules dialogs.
export function JusticeScales({ size = 40, color }: { size?: number; color: string }) {
  const W = size * 1.3;
  const beamW = size * 1.1;
  const pan = size * 0.4;
  return (
    <View accessible={false} style={{ width: W, height: size * 1.1, alignItems: 'center' }}>
      <View style={{ position: 'absolute', top: 0, width: size * 0.12, height: size * 0.12, borderRadius: size, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: size * 0.12, width: 2.5, height: size * 0.9, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: size * 0.16, width: beamW, height: 2.5, backgroundColor: color }} />
      {([-1, 1] as const).map((d) => (
        <View key={d} style={{ position: 'absolute', top: size * 0.16, left: W / 2 + d * (beamW / 2) - pan / 2, width: pan, alignItems: 'center' }}>
          <View style={{ width: 1, height: size * 0.34, backgroundColor: color }} />
          <View style={{ width: pan, height: pan * 0.45, borderBottomLeftRadius: pan, borderBottomRightRadius: pan, backgroundColor: color }} />
        </View>
      ))}
      <View style={{ position: 'absolute', bottom: 0, width: size * 0.45, height: 3, borderRadius: 2, backgroundColor: color }} />
    </View>
  );
}
