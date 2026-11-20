import React from 'react';
import { StyleSheet, View } from 'react-native';
import { fortune as p } from '../gameThemes/fortuneTheme';

// The small shrine you tap to draw a fortune: a roof, a lit door, a rope with paper streamers, and
// the offering box in front. Drawn with plain views, so it needs no image. `glow` lights it up
// while it is waiting to be tapped. `scale` shrinks it for the side of the slip pane.
export function ShrineIcon({ glow = false, scale = 1 }: { glow?: boolean; scale?: number }) {
  return (
    <View style={{ width: 130 * scale, height: 118 * scale }} accessible={false}>
      <View style={{ width: 130, height: 118, transform: [{ scale }], transformOrigin: 'top left' as any }}>
        {glow && <View style={s.halo} />}
        {/* roof */}
        <View style={s.roof} />
        <View style={s.eave} />
        {/* body */}
        <View style={s.body} />
        <View style={[s.pillar, { left: 20 }]} />
        <View style={[s.pillar, { left: 104 }]} />
        <View style={s.door}>
          <View style={s.doorLine} />
        </View>
        {/* rope and paper streamers */}
        <View style={s.rope} />
        {[30, 52, 74, 96].map((x, i) => (
          <View key={x} style={[s.shide, { left: x, transform: [{ rotate: i % 2 ? '8deg' : '-8deg' }] }]} />
        ))}
        {/* offering box and steps */}
        <View style={s.saisen} />
        <View style={s.step} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  halo: { position: 'absolute', left: -10, top: 0, width: 150, height: 118, borderRadius: 75, backgroundColor: p.lantern, opacity: 0.16 },
  roof: {
    position: 'absolute',
    left: 4,
    top: 6,
    width: 0,
    height: 0,
    borderLeftWidth: 62,
    borderRightWidth: 62,
    borderBottomWidth: 38,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: p.roof,
  },
  eave: { position: 'absolute', left: 1, top: 42, width: 128, height: 5, borderRadius: 2, backgroundColor: p.gold },
  body: { position: 'absolute', left: 20, top: 47, width: 90, height: 44, backgroundColor: p.vermilion },
  pillar: { position: 'absolute', top: 47, width: 6, height: 44, backgroundColor: p.vermilionDeep },
  door: { position: 'absolute', left: 55, top: 53, width: 20, height: 38, backgroundColor: p.lanternSoft, alignItems: 'center' },
  doorLine: { width: 2, height: 38, backgroundColor: p.vermilionDeep },
  rope: { position: 'absolute', left: 14, top: 49, width: 102, height: 4, borderRadius: 2, backgroundColor: p.paperEdge },
  shide: { position: 'absolute', top: 53, width: 7, height: 11, backgroundColor: p.paper },
  saisen: { position: 'absolute', left: 36, top: 91, width: 58, height: 14, backgroundColor: p.woodLight, borderTopWidth: 3, borderTopColor: p.gold },
  step: { position: 'absolute', left: 28, top: 105, width: 74, height: 7, borderRadius: 2, backgroundColor: p.stone },
});
