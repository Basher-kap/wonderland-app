import React from 'react';
import { View } from 'react-native';

export type GlyphKind = 'face' | 'step' | 'cross' | 'sun';

// A small carved glyph block, made of plain views (no image needed). Used for the frieze on the
// cave wall, the corners of the rules dialogs, and the altars at both ends of the floor.
export function MayaGlyph({ kind = 'face', size = 28, color }: { kind?: GlyphKind; size?: number; color: string }) {
  const u = size / 10; // everything is drawn on a 10x10 grid
  const bar = (x: number, y: number, w: number, h: number, key?: string) => (
    <View key={key} style={{ position: 'absolute', left: x * u, top: y * u, width: w * u, height: h * u, backgroundColor: color }} />
  );
  return (
    <View
      accessible={false}
      style={{ width: size, height: size, borderWidth: Math.max(1.5, u * 0.35), borderColor: color, borderRadius: u * 0.6 }}
    >
      <View style={{ width: size - u * 0.7, height: size - u * 0.7 }}>
        {kind === 'face' && (
          <>
            {bar(1.6, 2, 2, 2, 'e1')}
            {bar(5.4, 2, 2, 2, 'e2')}
            {bar(1.6, 5.6, 5.8, 1.2, 'm')}
          </>
        )}
        {kind === 'step' && (
          <>
            {bar(1.5, 1.5, 6, 1, 'a')}
            {bar(1.5, 1.5, 1, 6, 'b')}
            {bar(3.5, 3.5, 4, 1, 'c')}
            {bar(6.5, 3.5, 1, 4, 'd')}
          </>
        )}
        {kind === 'cross' && (
          <>
            {bar(4, 1.2, 1.4, 6.6, 'v')}
            {bar(1.2, 4, 6.6, 1.4, 'h')}
          </>
        )}
        {kind === 'sun' && (
          <>
            <View style={{ position: 'absolute', left: 2.4 * u, top: 2.4 * u, width: 3.2 * u, height: 3.2 * u, borderRadius: 3 * u, backgroundColor: color }} />
            {bar(0.8, 3.6, 1, 0.8, 'l')}
            {bar(6.8, 3.6, 1, 0.8, 'r')}
            {bar(3.6, 0.8, 0.8, 1, 't')}
            {bar(3.6, 6.8, 0.8, 1, 'b')}
          </>
        )}
      </View>
    </View>
  );
}
