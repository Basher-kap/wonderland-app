import React, { useMemo } from 'react';
import { ImageBackground, StyleSheet, View, useWindowDimensions } from 'react-native';
import { court as c, COURT_BG_IMAGE } from '../gameThemes/courtTheme';
import { JusticeScales } from './JusticeScales';

type Props = { children?: React.ReactNode };

const HALL = [c.dark1, c.dark2, c.dark3, c.dark4, c.dark5, c.dark6];

// Small deterministic pseudo-random so the dust stays the same on every render.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function Column({ side, offset, w, dim }: { side: 'left' | 'right'; offset: string; w: number; dim: number }) {
  const pos = side === 'left' ? { left: offset as any } : { right: offset as any };
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, width: w + 16, alignItems: 'center', opacity: dim }, pos]}>
      <View style={{ width: w + 16, height: 14, backgroundColor: c.stoneCap }} />
      <View style={{ flex: 1, width: w, backgroundColor: c.stone, flexDirection: 'row', justifyContent: 'space-evenly' }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 2, backgroundColor: c.stoneHi, opacity: 0.55 }} />
        ))}
      </View>
      <View style={{ width: w + 16, height: 18, backgroundColor: c.stoneCap }} />
    </View>
  );
}

// The courtroom, for the whole Janken Negotiation screen and its rules dialogs: stone columns, the
// high bench with its scales, one cold shaft of light, a stone floor, mist, and heavy dark edges.
export function CourtBackground({ children }: Props) {
  const { width, height } = useWindowDimensions();
  const dust = useMemo(() => {
    const r = rng(41);
    return Array.from({ length: 20 }, () => ({ x: 32 + Math.round(r() * 36), y: Math.round(14 + r() * 56), o: 0.2 + r() * 0.3 }));
  }, []);

  if (COURT_BG_IMAGE) {
    return (
      <ImageBackground source={COURT_BG_IMAGE} resizeMode="cover" style={styles.root}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3,7,13,0.35)' }]} />
        {children}
      </ImageBackground>
    );
  }

  const shaftW = Math.min(width * 1.15, 460);
  const shaftH = height * 0.8;
  const floorTop = height * 0.62;
  const floorLines = Math.ceil((height - floorTop) / 40);

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {HALL.map((col, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: col }} />
        ))}
      </View>

      <Column side="left" offset="-3%" w={30} dim={0.85} />
      <Column side="left" offset="11%" w={20} dim={0.5} />
      <Column side="right" offset="-3%" w={30} dim={0.85} />
      <Column side="right" offset="11%" w={20} dim={0.5} />

      {/* the judges' high bench, with three empty chairs and the scales above */}
      <View pointerEvents="none" style={styles.chairs}>
        {[64, 82, 64].map((h, i) => (
          <View key={i} style={{ width: i === 1 ? 52 : 40, height: h, backgroundColor: c.chair, borderWidth: 1, borderColor: c.stoneCap, borderTopLeftRadius: 22, borderTopRightRadius: 22 }} />
        ))}
      </View>
      <View pointerEvents="none" style={styles.scales}>
        <JusticeScales size={38} color={c.steel} />
      </View>
      <View pointerEvents="none" style={styles.bench}>
        <View style={{ flexDirection: 'row', gap: 8, padding: 8, flex: 1 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={{ flex: 1, backgroundColor: c.benchInlay, borderWidth: 1, borderColor: c.stoneCap }} />
          ))}
        </View>
      </View>

      {/* one cold shaft of light from above */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 24, left: (width - shaftW) / 2, width: 0, height: 0, borderLeftWidth: shaftW / 2, borderRightWidth: shaftW / 2, borderBottomWidth: shaftH, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: 'rgba(156,203,238,0.06)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 24, left: (width - shaftW * 0.5) / 2, width: 0, height: 0, borderLeftWidth: shaftW * 0.25, borderRightWidth: shaftW * 0.25, borderBottomWidth: shaftH, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: 'rgba(156,203,238,0.05)' }} />

      {/* dust hanging in the light */}
      {dust.map((d, i) => (
        <View key={i} pointerEvents="none" style={{ position: 'absolute', left: `${d.x}%`, top: `${d.y}%`, width: 2.5, height: 2.5, borderRadius: 3, backgroundColor: c.skyPale, opacity: d.o }} />
      ))}

      {/* the stone floor and the mist on it */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: floorTop, bottom: 0, backgroundColor: c.floor, borderTopWidth: 2, borderTopColor: c.stoneCap }}>
        {Array.from({ length: floorLines }, (_, i) => (
          <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: 18 + i * 40, height: 1, backgroundColor: 'rgba(156,203,238,0.07)' }} />
        ))}
      </View>
      {[0.1, 0.45].map((l, i) => (
        <View key={i} pointerEvents="none" style={{ position: 'absolute', bottom: 18 + i * 34, left: `${l * 100 - 20}%`, width: 260, height: 30, borderRadius: 30, backgroundColor: c.skyPale, opacity: 0.045 }} />
      ))}

      {/* the dark closes in from every edge */}
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={`l${i}`} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: i * 16, width: 16, backgroundColor: `rgba(0,0,0,${0.62 - i * 0.13})` }} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={`r${i}`} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, right: i * 16, width: 16, backgroundColor: `rgba(0,0,0,${0.62 - i * 0.13})` }} />
      ))}
      {[0, 1, 2].map((i) => (
        <View key={`b${i}`} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: i * 18, height: 18, backgroundColor: `rgba(0,0,0,${0.5 - i * 0.16})` }} />
      ))}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.dark1, overflow: 'hidden' },
  chairs: { position: 'absolute', top: 36, left: 0, right: 0, height: 86, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 34 },
  scales: { position: 'absolute', top: 2, left: 0, right: 0, alignItems: 'center', opacity: 0.7 },
  bench: { position: 'absolute', top: 112, left: '14%', right: '14%', height: 54, backgroundColor: c.bench, borderTopWidth: 3, borderTopColor: c.steelDim },
});
