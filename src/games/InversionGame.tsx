import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Dir, makeTask, MAX_CHANCES, PAIR, TASK_COUNT } from '../game/inversion';
import { colors, radius } from '../theme';
import type { GameProps } from './types';

// Inversion: follow the instruction about the arrows, but press the OPPOSITE button while the
// INVERSED sign blinks. Everybody gets the same tasks (from `seed`) and plays them at their own
// pace. A wrong button or running out of time costs a chance; with no chances left the player is
// out. The first to finish all the tasks wins, or the last player still in (GameScreen, registry:
// endsOnFirstFinish + endsWhenOneLeft). All the rules live in src/game/inversion.ts; this file is
// only the screen. The back/forfeit buttons are provided by GameScreen.

const CELL = 56; // one arrow cell, also the distance the moving arrows travel per loop
const FIELD_W = 240;
const FIELD_H = 140;
const FEEDBACK_MS = 350;
const ROTATION: Record<Dir, string> = { right: '0deg', down: '90deg', left: '180deg', up: '270deg' };

// One arrow drawn with plain views (a stem and a triangle head), pointing right, then rotated.
function Arrow({ dir, scale = 1, color }: { dir: Dir; scale?: number; color: string }) {
  return (
    <View style={{ width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', transform: [{ rotate: ROTATION[dir] }, { scale }] }}>
        <View style={{ width: 22, height: 10, backgroundColor: color }} />
        <View
          style={{
            width: 0,
            height: 0,
            borderTopWidth: 14,
            borderBottomWidth: 14,
            borderLeftWidth: 22,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: color,
          }}
        />
      </View>
    </View>
  );
}

// The arrows in the middle: either a stream of arrows sliding across the box, or one big arrow
// that stands still and points.
function ArrowField({ mode, dir }: { mode: 'moving' | 'pointing'; dir: Dir }) {
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (mode !== 'moving') return;
    slide.setValue(0);
    const loop = Animated.loop(
      Animated.timing(slide, { toValue: 1, duration: 650, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [mode, dir, slide]);

  const horizontal = dir === 'left' || dir === 'right';
  const sign = dir === 'right' || dir === 'down' ? 1 : -1;
  // The stream is longer than the box and starts one cell outside it; sliding it by exactly one
  // cell per loop makes the arrows look like they never stop.
  const translate = slide.interpolate({ inputRange: [0, 1], outputRange: [0, sign * CELL] });
  const cells = Array.from({ length: 8 }, (_, i) => i);

  return (
    <View style={styles.field}>
      {mode === 'pointing' ? (
        <Arrow dir={dir} scale={2} color={colors.experience} />
      ) : (
        <Animated.View
          style={{
            position: 'absolute',
            flexDirection: horizontal ? 'row' : 'column',
            ...(horizontal ? { left: -CELL, top: (FIELD_H - CELL) / 2 } : { top: -CELL, left: (FIELD_W - CELL) / 2 }),
            transform: horizontal ? [{ translateX: translate }] : [{ translateY: translate }],
          }}
        >
          {cells.map((i) => (
            <Arrow key={i} dir={dir} color={colors.experience} />
          ))}
        </Animated.View>
      )}
    </View>
  );
}

function Hearts({ left }: { left: number }) {
  return (
    <Text style={styles.hearts}>
      {Array.from({ length: MAX_CHANCES }, (_, i) => (i < left ? '♥' : '♡')).join(' ')}
    </Text>
  );
}

export function InversionGame({ seed, onFinish }: GameProps) {
  const [index, setIndex] = useState(0);
  const [chances, setChances] = useState(MAX_CHANCES);
  const [feedback, setFeedback] = useState<'ok' | 'bad' | null>(null);
  const startedAt = useRef(Date.now());
  const correct = useRef(0);
  const busy = useRef(false); // an answer is being shown: ignore taps and the timer
  const done = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const task = useMemo(() => makeTask(seed, index), [seed, index]);
  const bar = useRef(new Animated.Value(1)).current;
  const blink = useRef(new Animated.Value(1)).current;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      done.current = true;
    },
    []
  );

  const answer = (pressed: Dir | null) => {
    if (busy.current || done.current) return;
    busy.current = true;
    bar.stopAnimation();
    const ok = pressed === task.answer;
    if (ok) correct.current += 1;
    const left = ok ? chances : chances - 1;
    setFeedback(ok ? 'ok' : 'bad');
    setChances(left);
    later(() => {
      if (done.current) return;
      const total = Date.now() - startedAt.current;
      if (left <= 0) {
        done.current = true;
        onFinish({ finished: false, totalMs: total, score: correct.current });
      } else if (index + 1 >= TASK_COUNT) {
        done.current = true;
        onFinish({ finished: true, totalMs: total, score: correct.current });
      } else {
        setFeedback(null);
        busy.current = false;
        setIndex(index + 1);
      }
    }, FEEDBACK_MS);
  };

  // Every task has its own time limit: the bar runs down and, at zero, it counts as a mistake.
  useEffect(() => {
    bar.setValue(1);
    Animated.timing(bar, { toValue: 0, duration: task.timeLimitMs, easing: Easing.linear, useNativeDriver: false }).start(
      ({ finished }) => {
        if (finished) answer(null);
      }
    );
    return () => bar.stopAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // The INVERSED sign blinks.
  useEffect(() => {
    if (!task.inversed) return;
    blink.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.15, duration: 220, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 220, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [task, blink]);

  const [a, b] = PAIR[task.axis];

  return (
    <View style={styles.root}>
      <Hearts left={chances} />
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            { width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            feedback === 'ok' && { backgroundColor: colors.experience },
            feedback === 'bad' && { backgroundColor: colors.danger },
          ]}
        />
      </View>

      {/* Always takes the same room, so nothing jumps when the sign appears. */}
      <View style={styles.signRow}>
        {task.inversed && (
          <Animated.Text style={[styles.sign, { opacity: blink }]} accessibilityLabel="Inversed">
            INVERSED
          </Animated.Text>
        )}
      </View>

      <ArrowField key={index} mode={task.mode} dir={task.dir} />

      <Text style={styles.instruction}>{task.text}</Text>

      <View style={styles.buttons}>
        {[a, b].map((d) => (
          <Pressable
            key={d}
            onPress={() => answer(d)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.buttonText}>{d.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14, alignItems: 'center' },
  hearts: { color: colors.danger, fontSize: 24, letterSpacing: 4 },
  barTrack: { alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: colors.card, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: colors.muted },
  signRow: { height: 38, justifyContent: 'center' },
  sign: { color: colors.danger, fontSize: 30, fontWeight: '900', letterSpacing: 4 },
  field: {
    width: FIELD_W,
    height: FIELD_H,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  instruction: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center', minHeight: 56, paddingHorizontal: 8 },
  buttons: { flexDirection: 'row', gap: 14, alignSelf: 'stretch' },
  button: {
    flex: 1,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.experience,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: 2 },
});
