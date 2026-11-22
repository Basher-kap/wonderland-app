import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Dir, makeTask, MAX_CHANCES, PAIR, TASK_COUNT } from '../game/inversion';
import { InversionGamepad, displayWeight, esp, FONT_DISPLAY } from '../gameThemes/inversion';
import type { GameProps } from './types';

// Inversion: follow the instruction about the arrows, but press the OPPOSITE button while the
// INVERSED sign blinks. Everybody gets the same tasks (from `seed`) and plays them at their own
// pace. A wrong button or running out of time costs a chance; with no chances left the player is
// out. The first to finish all the tasks wins, or the last player still in (GameScreen, registry:
// endsOnFirstFinish + endsWhenOneLeft). All the rules live in src/game/inversion.ts; this file is
// only the screen. The back/forfeit buttons are provided by GameScreen.
//
// THE LOOK (esports final, see gameThemes/inversion/theme.ts): the arena is the screen background
// (EsportsArenaBackground). From the top: the chances and the task counter, the time bar, the
// INVERSED sign, the arrow monitor, the instruction, and the controller (components/InversionGamepad).
// The game is registered as `fullScreen`, so GameScreen gives it the whole screen with no ScrollView.
// The monitor takes whatever height is left, and the controller's height follows the screen, so the
// buttons are always inside the frame.

const BASE = 56; // the size the arrow shape is drawn at; it is scaled to the monitor
const FEEDBACK_MS = 350;
const MIC_SPACE = 128; // the lobby's mic pill floats in the top-right corner (VoiceButton): keep clear
const ROTATION: Record<Dir, string> = { right: '0deg', down: '90deg', left: '180deg', up: '270deg' };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const pad = (n: number) => String(n).padStart(2, '0');

// One arrow drawn with plain views (a stem and a triangle head), pointing right, then rotated.
// `cell` is the size of the square it sits in; the arrow is scaled to it.
function Arrow({ dir, cell, boost = 1, color }: { dir: Dir; cell: number; boost?: number; color: string }) {
  return (
    <View style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', transform: [{ rotate: ROTATION[dir] }, { scale: (cell / BASE) * boost }] }}>
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

// The arrows on the monitor: either a stream of arrows sliding across the screen (`moveDir`), or one
// big arrow that stands still. The arrow shapes point `pointDir`, which in a "pointing" task can
// differ from the way they slide. `w` x `h` is the screen's size.
function ArrowField({ pointDir, moveDir, w, h }: { pointDir: Dir; moveDir: Dir | null; w: number; h: number }) {
  const slide = useRef(new Animated.Value(0)).current;
  const dir = moveDir ?? pointDir;
  const cell = clamp(Math.floor(Math.min(h * 0.42, w * 0.24)), 30, 64);
  useEffect(() => {
    if (!moveDir) return;
    slide.setValue(0);
    const loop = Animated.loop(
      Animated.timing(slide, { toValue: 1, duration: 650, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [moveDir, slide]);

  const horizontal = dir === 'left' || dir === 'right';
  const sign = dir === 'right' || dir === 'down' ? 1 : -1;
  // The stream is longer than the screen and starts one cell outside it; sliding it by exactly one
  // cell per loop makes the arrows look like they never stop.
  const translate = slide.interpolate({ inputRange: [0, 1], outputRange: [0, sign * cell] });
  const count = Math.ceil(Math.max(w, h) / cell) + 3;
  const cells = Array.from({ length: count }, (_, i) => i);

  return (
    <View style={{ width: w, height: h, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {!moveDir ? (
        <Arrow dir={pointDir} cell={cell} boost={1.9} color={esp.cyan} />
      ) : (
        <Animated.View
          style={{
            position: 'absolute',
            flexDirection: horizontal ? 'row' : 'column',
            ...(horizontal ? { left: -cell, top: (h - cell) / 2 } : { top: -cell, left: (w - cell) / 2 }),
            transform: horizontal ? [{ translateX: translate }] : [{ translateY: translate }],
          }}
        >
          {cells.map((i) => (
            <Arrow key={i} dir={pointDir} cell={cell} color={esp.cyan} />
          ))}
        </Animated.View>
      )}
    </View>
  );
}

// The chances, as a health bar of slanted segments.
function Health({ left }: { left: number }) {
  const tone = left <= 1 ? esp.hot : left <= 2 ? esp.amber : esp.cyan;
  return (
    <View style={styles.health} accessible accessibilityLabel={`${left} chances left`}>
      {Array.from({ length: MAX_CHANCES }, (_, i) => (
        <View
          key={i}
          style={[styles.segment, i < left ? { backgroundColor: tone, borderColor: tone } : { backgroundColor: 'transparent', borderColor: esp.hot, opacity: 0.55 }]}
        />
      ))}
    </View>
  );
}

// Four brackets in the corners of the monitor.
function Brackets({ color }: { color: string }) {
  const arm = { position: 'absolute' as const, width: 16, height: 16, borderColor: color };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[arm, { top: 6, left: 6, borderTopWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[arm, { top: 6, right: 6, borderTopWidth: 2, borderRightWidth: 2 }]} />
      <View style={[arm, { bottom: 6, left: 6, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[arm, { bottom: 6, right: 6, borderBottomWidth: 2, borderRightWidth: 2 }]} />
    </View>
  );
}

export function InversionGame({ seed, onFinish }: GameProps) {
  const [index, setIndex] = useState(0);
  const [chances, setChances] = useState(MAX_CHANCES);
  const [feedback, setFeedback] = useState<'ok' | 'bad' | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 }); // the whole game area
  const [mon, setMon] = useState({ w: 0, h: 0 }); // the space the monitor may take
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

  const onBox = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (b.w === width && b.h === height ? b : { w: width, h: height }));
  };
  const onMon = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setMon((m) => (m.w === width && m.h === height ? m : { w: width, h: height }));
  };

  const pair = PAIR[task.axis];
  const ctrlW = Math.min(box.w - 16, 460);
  const ctrlH = clamp(Math.round(box.h * 0.3), 128, 190);
  const monW = Math.min(mon.w, 420);
  const monH = Math.max(0, mon.h);
  const edge = feedback === 'ok' ? esp.lime : feedback === 'bad' ? esp.hot : esp.cyan;
  const barColor = bar.interpolate({ inputRange: [0, 0.3, 0.55, 1], outputRange: [esp.hot, esp.amber, esp.cyan, esp.cyan] });

  return (
    <View style={styles.root} onLayout={onBox}>
      <View style={styles.hud}>
        <Health left={chances} />
        <Text style={styles.counter} accessibilityLabel={`Task ${index + 1} of ${TASK_COUNT}`}>
          {pad(index + 1)}/{TASK_COUNT}
        </Text>
      </View>

      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            { width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: feedback === 'ok' ? esp.lime : feedback === 'bad' ? esp.hot : barColor },
          ]}
        />
      </View>

      {/* Always takes the same room, so nothing jumps when the sign appears. */}
      <View style={styles.signRow}>
        {task.inversed && (
          <Animated.View style={[styles.sign, { opacity: blink }]} accessible accessibilityLabel="Inversed">
            <Text style={styles.signText}>INVERSED</Text>
          </Animated.View>
        )}
      </View>

      <View style={styles.monArea} onLayout={onMon}>
        {monH > 40 && (
          <View style={[styles.bezel, { width: monW, height: monH, borderColor: edge }]}>
            <View style={styles.screen}>
              {[0.25, 0.5, 0.75].map((p) => (
                <View key={`h${p}`} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: `${p * 100}%`, height: 1, backgroundColor: esp.screenGrid }} />
              ))}
              {[0.2, 0.4, 0.6, 0.8].map((p) => (
                <View key={`v${p}`} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: `${p * 100}%`, width: 1, backgroundColor: esp.screenGrid }} />
              ))}
              <ArrowField key={index} pointDir={task.pointDir} moveDir={task.moveDir} w={monW - 12} h={monH - 12} />
              {feedback === 'bad' && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,46,99,0.22)' }]} />}
              <Brackets color={edge} />
            </View>
          </View>
        )}
      </View>

      <Text style={[styles.instruction, { fontSize: box.w >= 360 ? 20 : 18 }]}>{task.text}</Text>

      {box.w > 0 && (
        <View style={{ alignSelf: 'center', marginTop: 6 }}>
          <InversionGamepad width={ctrlW} height={ctrlH} active={[pair[0], pair[1]]} onPress={(d) => answer(d)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 18, paddingHorizontal: 12, paddingBottom: 8 },
  hud: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 36, paddingRight: MIC_SPACE },
  health: { flexDirection: 'row', gap: 5 },
  segment: { width: 22, height: 16, borderWidth: 2, borderRadius: 2, transform: [{ skewX: '-20deg' }] },
  counter: { color: esp.cyan, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 20, fontVariant: ['tabular-nums'] },
  barTrack: { alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: 'rgba(18,20,42,0.9)', borderWidth: 1, borderColor: esp.bezelEdge, overflow: 'hidden', marginTop: 6 },
  barFill: { height: 8 },
  signRow: { height: 38, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  sign: {
    paddingHorizontal: 18,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: esp.hot,
    borderRadius: 4,
    backgroundColor: 'rgba(255,46,99,0.16)',
  },
  signText: {
    color: esp.hot,
    fontFamily: FONT_DISPLAY,
    fontWeight: displayWeight,
    fontSize: 26,
    letterSpacing: 5,
    textShadowColor: esp.hot,
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  monArea: { flex: 1, minHeight: 90, alignItems: 'center', justifyContent: 'center' },
  bezel: { padding: 5, borderRadius: 14, backgroundColor: esp.bezel, borderWidth: 2 },
  screen: { flex: 1, borderRadius: 9, overflow: 'hidden', backgroundColor: esp.screen, alignItems: 'center', justifyContent: 'center' },
  instruction: { color: esp.text, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, textAlign: 'center', minHeight: 52, paddingHorizontal: 8, marginTop: 8, letterSpacing: 0.5 },
});
