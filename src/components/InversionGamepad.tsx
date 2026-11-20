import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Dir } from '../game/inversion';
import { esp } from '../gameThemes/inversionTheme';

// The answer buttons, built as a game controller: a D-pad on the left grip and four face buttons on
// the right grip. Both do the same thing, so either thumb can answer. Only the two directions that
// the task is about (`active`) are lit; the other two are dark and do nothing.

const ROTATION: Record<Dir, string> = { up: '0deg', right: '90deg', down: '180deg', left: '270deg' };
const FACE: Record<Dir, string> = { up: esp.lime, right: esp.amber, down: esp.blue, left: esp.violet };
const LABEL: Record<Dir, string> = { up: 'Up', right: 'Right', down: 'Down', left: 'Left' };

// A solid triangle pointing `dir`.
function Tri({ dir, size, color }: { dir: Dir; size: number; color: string }) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: size,
        borderRightWidth: size,
        borderBottomWidth: size * 1.6,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
        transform: [{ rotate: ROTATION[dir] }],
      }}
    />
  );
}

type Props = {
  width: number;
  height: number;
  active: [Dir, Dir];
  onPress: (d: Dir) => void;
};

export function InversionGamepad({ width, height, active, onPress }: Props) {
  const P = Math.floor(Math.min(height - 28, (width - 3 * 14) / 2, 150)); // the size of each cluster
  const arm = P / 3;
  const b = P * 0.36; // a face button
  const top = (height - P) / 2;
  const on = (d: Dir) => active.includes(d);

  const dpadArm = (d: Dir) => {
    const pos = {
      up: { left: arm, top: 0 },
      down: { left: arm, top: arm * 2 },
      left: { left: 0, top: arm },
      right: { left: arm * 2, top: arm },
    }[d];
    return (
      <Pressable
        key={d}
        onPress={() => on(d) && onPress(d)}
        disabled={!on(d)}
        accessibilityRole="button"
        accessibilityLabel={`D-pad ${LABEL[d]}`}
        accessibilityState={{ disabled: !on(d) }}
        style={({ pressed }) => [
          styles.arm,
          { width: arm, height: arm, ...pos },
          on(d) && { backgroundColor: 'rgba(53,224,255,0.14)' },
          pressed && { backgroundColor: 'rgba(53,224,255,0.40)', transform: [{ scale: 0.94 }] },
        ]}
      >
        <Tri dir={d} size={P * 0.075} color={on(d) ? esp.cyan : esp.glyphOff} />
      </Pressable>
    );
  };

  const faceButton = (d: Dir) => {
    const pos = {
      up: { left: (P - b) / 2, top: 0 },
      down: { left: (P - b) / 2, top: P - b },
      left: { left: 0, top: (P - b) / 2 },
      right: { left: P - b, top: (P - b) / 2 },
    }[d];
    return (
      <Pressable
        key={d}
        onPress={() => on(d) && onPress(d)}
        disabled={!on(d)}
        accessibilityRole="button"
        accessibilityLabel={`Button ${LABEL[d]}`}
        accessibilityState={{ disabled: !on(d) }}
        style={({ pressed }) => [
          styles.face,
          { width: b, height: b, borderRadius: b / 2, ...pos },
          on(d)
            ? { backgroundColor: FACE[d], borderColor: 'rgba(255,255,255,0.55)' }
            : { backgroundColor: esp.keyOff, borderColor: esp.bodyLight },
          pressed && { transform: [{ scale: 0.9 }], opacity: 0.85 },
        ]}
      >
        <Tri dir={d} size={b * 0.17} color={on(d) ? esp.keyDark : esp.glyphOff} />
      </Pressable>
    );
  };

  const dirs: Dir[] = ['up', 'right', 'down', 'left'];
  return (
    <View style={{ width, height }}>
      {/* the body: a wide bar with a rounded grip hanging under each end */}
      <View pointerEvents="none" style={[styles.bar, { height: height * 0.76, borderRadius: height * 0.38 }]} />
      <View pointerEvents="none" style={[styles.grip, { left: width * 0.02, width: height * 0.7, height: height * 0.7, borderRadius: height * 0.35 }]} />
      <View pointerEvents="none" style={[styles.grip, { right: width * 0.02, width: height * 0.7, height: height * 0.7, borderRadius: height * 0.35 }]} />
      <View pointerEvents="none" style={[styles.led, { top: 9, left: width * 0.32, right: width * 0.32 }]} />

      {/* the D-pad */}
      <View style={{ position: 'absolute', left: 16, top, width: P, height: P }}>
        {/* the cross is drawn twice, a lighter one under a slightly smaller dark one, so it has a clean rim */}
        <View pointerEvents="none" style={[styles.crossH, { top: arm, height: arm, borderRadius: arm * 0.3, backgroundColor: esp.bodyLight }]} />
        <View pointerEvents="none" style={[styles.crossV, { left: arm, width: arm, borderRadius: arm * 0.3, backgroundColor: esp.bodyLight }]} />
        <View pointerEvents="none" style={[styles.crossH, { top: arm + 1.5, height: arm - 3, left: 1.5, right: 1.5, borderRadius: arm * 0.3 }]} />
        <View pointerEvents="none" style={[styles.crossV, { left: arm + 1.5, width: arm - 3, top: 1.5, bottom: 1.5, borderRadius: arm * 0.3 }]} />
        {dirs.map(dpadArm)}
      </View>

      {/* the face buttons */}
      <View style={{ position: 'absolute', right: 16, top, width: P, height: P }}>{dirs.map(faceButton)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: esp.body, borderTopWidth: 2, borderTopColor: esp.bodyLight },
  grip: { position: 'absolute', bottom: 0, backgroundColor: esp.body },
  led: { position: 'absolute', height: 3, borderRadius: 2, backgroundColor: esp.cyan, opacity: 0.85 },
  crossH: { position: 'absolute', left: 0, right: 0, backgroundColor: esp.keyDark },
  crossV: { position: 'absolute', top: 0, bottom: 0, backgroundColor: esp.keyDark },
  arm: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  face: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
