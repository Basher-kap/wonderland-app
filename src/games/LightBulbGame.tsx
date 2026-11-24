import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path, Polygon, Rect } from 'react-native-svg';
import { BANDS, BEAM_BANDS, buildBoard, depthAt, flip, isExpired, laneAt, pitchAt, remainingMs, SWITCH_COUNT, TIME_LIMIT_MS } from '../game/lightBulb';
import { useReduceMotion } from '../components/ui/useReduceMotion';
import { BlastArt, BulbArt, displayWeight, FLOOR_H, FONT_DISPLAY, ruins, SwitchArt, TntArt } from '../gameThemes/lightBulb';
import type { GameProps } from './types';

// Light Bulb: 8 switches along the top, 8 terminals along the bottom (1 light bulb, 7 TNT), and a
// braid of identical grey wires between them. Pick ONE switch and throw it: the right one lights the
// bulb, any other one sets off the TNT. The fuse is 1 minute long; when it runs out the TNT goes off too.
// Everybody in the round gets the same tangle (from `seed`); the first player to light the bulb wins
// and the round ends for everybody (registry: endsOnFirstFinish). All the rules live in
// src/game/lightBulb.ts; this file is only the screen.
//
// A tap on a switch only ARMS it (the lever goes up, amber); the player must press THROW THE SWITCH to
// commit, so a slip of the thumb does not cost the round. The clock keeps running meanwhile.
//
// THE LOOK (the ruins of an old house, see gameThemes/lightBulb/theme.ts): the room is the screen
// background, drawn by RuinsBackground; this file draws the fuse, the fuse box, the wires and the
// terminals. The game is registered as `fullScreen`, so GameScreen gives it the whole screen with no
// ScrollView; the board is sized from the space it is given (onLayout), so it never needs a scroll.

const MIC_SPACE = 128; // the lobby's mic pill floats in the top-right corner (VoiceButton): keep clear
const HUD_H = 46;
const FOOT_H = 78; // the question, and the button that throws the switch
const BEAM_THICK = 0.72; // the fallen beam covers this fraction of its band
const SAMPLES_PER_BAND = 8; // how finely each wire is drawn

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${pad(Math.ceil(ms / 1000) % 60)}`;

type Phase = 'playing' | 'lit' | 'boom';

export function LightBulbGame({ seed, onFinish }: GameProps) {
  const board = useMemo(() => buildBoard(seed), [seed]);
  const reduce = useReduceMotion();
  const reduceRef = useRef(reduce); // the fuse timer below is set up once; it must see the latest setting
  reduceRef.current = reduce;
  const [phase, setPhase] = useState<Phase>('playing');
  const [armed, setArmed] = useState<number | null>(null);
  const [thrown, setThrown] = useState<number | null>(null);
  const [byFuse, setByFuse] = useState(false); // the blast came from the fuse running out
  const [elapsed, setElapsed] = useState(0);
  const [finishedMs, setFinishedMs] = useState<number | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const startedAt = useRef(Date.now());
  const done = useRef(false);
  const flash = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  const boom = (ms: number, fuse: boolean, picked: number | null) => {
    if (done.current) return;
    done.current = true;
    setElapsed(ms);
    setFinishedMs(ms);
    setByFuse(fuse);
    setThrown(picked);
    setPhase('boom');
    onFinish({ finished: false, totalMs: ms });
    if (!reduceRef.current) {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(flash, { toValue: 0.85, duration: 70, useNativeDriver: true }),
          Animated.timing(flash, { toValue: 0, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.sequence(
          [14, -12, 9, -7, 4, -2, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 55, useNativeDriver: true }))
        ),
      ]).start();
    }
  };

  // The fuse: the clock runs from the moment the board appears. When it runs out, the TNT goes off.
  useEffect(() => {
    startedAt.current = Date.now();
    const id = setInterval(() => {
      if (done.current) return;
      const ms = Date.now() - startedAt.current;
      if (isExpired(ms)) boom(TIME_LIMIT_MS, true, null);
      else setElapsed(ms);
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPressSwitch = (i: number) => {
    if (done.current) return;
    setArmed((a) => (a === i ? null : i));
  };

  // ONE attempt: the right switch lights the bulb, any other one sets off the TNT.
  const onThrow = () => {
    if (done.current || armed === null) return;
    const ms = Math.min(Date.now() - startedAt.current, TIME_LIMIT_MS);
    if (flip(board, armed) === 'lit') {
      done.current = true;
      setElapsed(ms);
      setFinishedMs(ms);
      setThrown(armed);
      setPhase('lit');
      onFinish({ finished: true, totalMs: ms });
    } else {
      boom(ms, false, armed);
    }
  };

  const onArea = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea((a) => (a.w === width && a.h === height ? a : { w: width, h: height }));
  };

  // ---- the board's geometry, all from the space the screen gives ----
  const BW = Math.max(0, Math.min(area.w - 16, 520));
  const BH = Math.max(0, area.h - FOOT_H);
  const laneW = BW / SWITCH_COUNT;
  const laneX = (lane: number) => (lane + 0.5) * laneW;
  const swW = Math.min(laneW * 0.84, 42);
  const swH = swW * 1.18;
  const y0 = swH + 8; // where the wires leave the fuse box
  const termH = Math.max(46, laneW * 1.55);
  const y1 = BH - termH; // where the wires reach the terminals
  // The bands are of uneven height (board.bandTop), so a level's height comes from the board.
  const levelY = (u: number) => y0 + (y1 - y0) * depthAt(board, u);
  const bulbR = Math.min(laneW * 0.3, 15);
  const tntW = Math.min(laneW * 0.72, 30);
  const tntH = tntW * 1.25;
  const bulbCy = y1 + bulbR * 1.7;
  const tntCy = y1 + tntH * 0.3 + tntH / 2 + 3;

  // One path per wire, sampled finely: it swaps lanes with a neighbour in an S whose timing differs from
  // pair to pair, drifts sideways on its own slow curve, and the whole bundle squeezes together in the
  // middle (pitchAt). The geometry is in lane units (game/lightBulb.ts); here it is only scaled to pixels.
  const wirePaths = useMemo(() => {
    if (BW <= 0 || BH <= 0) return [] as string[];
    const steps = BANDS * SAMPLES_PER_BAND;
    return Array.from({ length: SWITCH_COUNT }, (_, w) => {
      let d = '';
      for (let k = 0; k <= steps; k++) {
        const u = (BANDS * k) / steps;
        const x = BW / 2 + (laneAt(board, w, u) - (SWITCH_COUNT - 1) / 2) * laneW * pitchAt(u);
        d += `${k === 0 ? 'M' : 'L'}${x.toFixed(1)} ${levelY(u).toFixed(1)} `;
      }
      return d;
    });
    // levelY and laneW only depend on the board and the measured area (BW, BH)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, BW, BH]);

  const lit = phase === 'lit';
  const blasting = phase === 'boom';
  // Which TNT goes off: the one at the end of the wrong wire, or ALL of them when the fuse ran out.
  const blastTerminals = useMemo(() => {
    if (!blasting) return new Set<number>();
    if (byFuse || thrown === null) return new Set(Array.from({ length: SWITCH_COUNT }, (_, t) => t).filter((t) => t !== board.bulbTerminal));
    return new Set([board.terminalOf[thrown]]);
  }, [blasting, byFuse, thrown, board]);

  const remaining = remainingMs(elapsed);
  const left = remaining / TIME_LIMIT_MS;
  const urgent = remaining <= 10_000 && phase === 'playing';

  const message =
    phase === 'lit'
      ? 'The light is on.'
      : phase === 'boom'
      ? byFuse
        ? 'The fuse ran out. The TNT went off.'
        : 'That wire led to TNT.'
      : armed !== null
      ? `Switch ${armed + 1} is armed. There is no taking it back.`
      : 'Which switch turns on the light?';

  return (
    <View style={[styles.root, { paddingBottom: FLOOR_H }]}>
      <View style={styles.hud}>
        <View style={[styles.tag, urgent && styles.tagUrgent]} accessible accessibilityLabel={`Fuse, ${clock(remaining)} left`}>
          <Text style={[styles.clock, urgent && { color: ruins.warn }]}>{clock(remaining)}</Text>
        </View>
        <View style={styles.fuseTrack} accessible={false}>
          <View style={[styles.fuseBurnt, { width: `${Math.max(0, Math.min(1, left)) * 100}%`, backgroundColor: urgent ? ruins.warn : ruins.tntFuse }]} />
          {phase === 'playing' && <View style={[styles.spark, { left: `${Math.max(0, Math.min(1, left)) * 100}%` }]} />}
        </View>
      </View>

      <View style={styles.area} onLayout={onArea}>
        {BW > 0 && BH > 0 && (
          <Animated.View style={{ width: BW, height: BH, transform: [{ translateX: shake }] }}>
            <Svg width={BW} height={BH}>
              {/* the fuse box and the terminal rail */}
              <Rect x={0} y={0} width={BW} height={y0 - 2} rx={4} fill={ruins.panel} stroke={ruins.panelEdge} strokeWidth={2} />
              <Rect x={0} y={y1 - 3} width={BW} height={BH - y1 + 3} rx={4} fill={ruins.panel} stroke={ruins.panelEdge} strokeWidth={2} />

              {/* the wires: all the same grey. Each has a dark edge so a crossing shows who goes over whom. */}
              {board.paintOrder.map((w) => (
                <React.Fragment key={w}>
                  <Path d={wirePaths[w]} fill="none" stroke={ruins.wireShade} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d={wirePaths[w]} fill="none" stroke={ruins.wire} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                </React.Fragment>
              ))}

              {/* fallen beams: they hide a stretch of the wires, where nothing swaps places */}
              {BEAM_BANDS.map((b, i) => {
                const bandH = levelY(b + 1) - levelY(b);
                const h = bandH * BEAM_THICK;
                const top = levelY(b) + (bandH - h) / 2;
                const slant = h * 0.35;
                return (
                  <React.Fragment key={b}>
                    <Polygon
                      points={`-4,${top} ${BW + 4},${top + (i ? slant : -slant) * 0.3} ${BW + 4},${top + h + (i ? slant : -slant) * 0.3} -4,${top + h}`}
                      fill={ruins.lath}
                      stroke={ruins.soot}
                      strokeWidth={2}
                    />
                    <Line x1={0} y1={top + h * 0.35} x2={BW} y2={top + h * 0.35 + (i ? slant : -slant) * 0.3} stroke={ruins.soot} strokeWidth={1} opacity={0.5} />
                    <Line x1={BW * 0.3} y1={top + 1} x2={BW * 0.34} y2={top + h - 1} stroke={ruins.soot} strokeWidth={1.2} opacity={0.6} />
                    <Line x1={BW * 0.72} y1={top + 1} x2={BW * 0.69} y2={top + h - 1} stroke={ruins.soot} strokeWidth={1.2} opacity={0.6} />
                  </React.Fragment>
                );
              })}

              {/* the switches */}
              {Array.from({ length: SWITCH_COUNT }, (_, i) => (
                <SwitchArt key={i} cx={laneX(i)} cy={swH / 2 + 3} w={swW} label={String(i + 1)} armed={armed === i && phase === 'playing'} thrown={thrown === i} />
              ))}

              {/* the terminals: the bulb and the TNT */}
              {Array.from({ length: SWITCH_COUNT }, (_, t) =>
                t === board.bulbTerminal ? (
                  <BulbArt key={t} cx={laneX(t)} cy={bulbCy} r={bulbR} lit={lit} />
                ) : blastTerminals.has(t) ? (
                  <BlastArt key={t} cx={laneX(t)} cy={tntCy} r={Math.min(laneW * 0.8, tntH * 0.9)} />
                ) : (
                  <TntArt key={t} cx={laneX(t)} cy={tntCy} w={tntW} />
                )
              )}
            </Svg>

            {/* the touch targets sit over the switches (a whole lane wide, so a thumb can hit them) */}
            {Array.from({ length: SWITCH_COUNT }, (_, i) => (
              <Pressable
                key={i}
                onPress={() => onPressSwitch(i)}
                disabled={phase !== 'playing'}
                accessibilityRole="button"
                accessibilityLabel={`Switch ${i + 1}`}
                accessibilityState={{ selected: armed === i, disabled: phase !== 'playing' }}
                style={{ position: 'absolute', left: i * laneW, top: 0, width: laneW, height: y0 + 4 }}
              />
            ))}
          </Animated.View>
        )}

        {/* the foot: the question and the button that throws the switch */}
        <View style={[styles.foot, { width: BW > 0 ? BW : '100%' }]}>
          <Text style={[styles.message, phase === 'boom' && { color: ruins.warn }]} accessibilityLiveRegion="polite">
            {message}
          </Text>
          {phase === 'playing' && (
            <Pressable
              onPress={onThrow}
              disabled={armed === null}
              accessibilityRole="button"
              accessibilityLabel="Throw the switch"
              accessibilityState={{ disabled: armed === null }}
              style={({ pressed }) => [styles.throwBtn, armed === null && styles.throwOff, pressed && armed !== null && { transform: [{ translateY: 2 }] }]}
            >
              <Text style={[styles.throwText, armed === null && { color: ruins.textDim }]}>THROW THE SWITCH</Text>
            </Pressable>
          )}
          {finishedMs !== null && phase === 'lit' && <Text style={styles.time}>{(finishedMs / 1000).toFixed(2)}s</Text>}
        </View>
      </View>

      {/* the flash of the blast over the whole screen */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: ruins.blast, opacity: flash }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, paddingRight: MIC_SPACE, height: HUD_H },
  tag: {
    minHeight: 34,
    minWidth: 62,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 3,
    backgroundColor: ruins.paper,
    borderWidth: 2,
    borderColor: ruins.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagUrgent: { borderColor: ruins.warn },
  clock: { color: ruins.ink, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 18, fontVariant: ['tabular-nums'] },
  fuseTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: ruins.soot, borderWidth: 1, borderColor: ruins.panelEdge, justifyContent: 'center' },
  fuseBurnt: { height: 4, marginLeft: 1, borderRadius: 2 },
  spark: { position: 'absolute', width: 10, height: 10, borderRadius: 5, marginLeft: -4, backgroundColor: ruins.blast, borderWidth: 2, borderColor: ruins.blastCore },

  area: { flex: 1, alignItems: 'center', paddingTop: 4 },
  foot: { height: FOOT_H, alignItems: 'center', justifyContent: 'center', gap: 6 },
  message: { color: ruins.text, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 14, textAlign: 'center' },
  throwBtn: {
    minHeight: 40,
    paddingHorizontal: 22,
    borderRadius: 3,
    backgroundColor: ruins.tnt,
    borderWidth: 2,
    borderColor: ruins.tntDark,
    borderBottomWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  throwOff: { backgroundColor: ruins.panel, borderColor: ruins.panelEdge },
  throwText: { color: ruins.text, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 14, letterSpacing: 1.2 },
  time: { color: ruins.bulbGlow, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 26, fontVariant: ['tabular-nums'] },
});
