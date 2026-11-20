import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { calc as c, CALC_BG_IMAGE } from '../gameThemes/humanCalculatorTheme';

type Props = { children?: React.ReactNode };

// The quiz-show studio, for the whole Human Calculator screen and its rules dialogs:
// wine-red curtains on both sides, a marquee valance, a spotlight, and the stage floor.
export function QuizStageBackground({ children }: Props) {
  if (CALC_BG_IMAGE) {
    return (
      <ImageBackground source={CALC_BG_IMAGE} resizeMode="cover" style={styles.root}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,8,20,0.3)' }]} />
        {children}
      </ImageBackground>
    );
  }
  return (
    <View style={styles.root}>
      {/* spotlight */}
      <View pointerEvents="none" style={styles.spot}>
        {[1, 0.74, 0.5].map((k, i) => (
          <View key={i} style={{ position: 'absolute', alignSelf: 'center', top: (1 - k) * 170, width: 340 * k, height: 340 * k, borderRadius: 340, backgroundColor: c.spot, opacity: 0.035 }} />
        ))}
      </View>

      {/* curtains */}
      {(['left', 'right'] as const).map((side) => (
        <View key={side} pointerEvents="none" style={[styles.curtain, side === 'left' ? { left: 0 } : { right: 0 }]}>
          {[0, 1, 2, 3].map((f) => (
            <View key={f} style={{ flex: 1, backgroundColor: f % 2 ? c.curtainFold : c.curtain }} />
          ))}
        </View>
      ))}

      {/* marquee */}
      <View pointerEvents="none" style={styles.valance}>
        {Array.from({ length: 14 }, (_, i) => (
          <View key={i} style={styles.bulb} />
        ))}
      </View>

      {/* stage floor */}
      <View pointerEvents="none" style={styles.floor}>
        <View style={styles.lip} />
        <View style={styles.plankLine} />
        <View style={styles.plankLine} />
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.stage, overflow: 'hidden' },
  spot: { position: 'absolute', left: 0, right: 0, top: 26, height: 340 },
  curtain: { position: 'absolute', top: 0, bottom: 0, width: '12%', flexDirection: 'row' },
  valance: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 22,
    backgroundColor: c.curtainFold,
    borderBottomWidth: 3,
    borderBottomColor: c.gold,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  bulb: { width: 6, height: 6, borderRadius: 6, backgroundColor: c.gold, opacity: 0.9 },
  floor: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 70, backgroundColor: '#1B1430', justifyContent: 'space-evenly' },
  lip: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: c.gold, opacity: 0.8 },
  plankLine: { height: 2, backgroundColor: 'rgba(255,255,255,0.05)' },
});
