import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import { beatAt, CARD_COUNT, endTurn, FLIP_MS, isCleared, layout, matchedPairs, MAX_TURNS, newState, PAIR_COUNT, pick, READY_MS } from '../game/memoryCard';
import type { Icon, State } from '../game/memoryCard';
import { useReduceMotion } from '../components/ui/useReduceMotion';
import { displayWeight, FLOOR_H, FONT_DISPLAY, seance } from '../gameThemes/memoryCard';
import type { GameProps } from './types';

// Memory Card: 18 cards face down, 3 icons (brain, earth, dice), 6 of each; any two with the same icon
// are a pair. Everybody gets the same board (from `seed`) on their own screen and the turns run on a
// shared beat: 3 seconds to be ready, then a 3-second window in which you flip 2 cards, then the next beat.
// A pair stays face up; a miss turns back over when the window closes. Whoever turns over the last pair
// first clears the game and the round ends for everybody (registry: endsOnFirstFinish). All the rules and
// the clock live in src/game/memoryCard.ts; this file is only the screen.
//
// THE LOOK (a séance chamber, see gameThemes/memoryCard/theme.ts): the room, the round table and the
// candles are the screen background, drawn by SeanceBackground; this file draws the clock and the tarot-style
// cards. The game is registered as `fullScreen`, so GameScreen gives it the whole screen with no
// ScrollView; the cards are sized from the space they are given (onLayout), so they never need a scroll.

const MIC_SPACE = 128; // the lobby's mic pill floats in the top-right corner (VoiceButton): keep clear
const HUD_H = 50;
const FOOT_H = 34;
const GAP = 8;
const MAX_ASPECT = 1.6; // cards may be wider than tall (they lie across the table) but not by more than this
const MIN_ASPECT = 0.62;

const ICON_NAME: Record<Icon, string> = { brain: 'brain', earth: 'earth', dice: 'dice-5' };
const ICON_COLOUR: Record<Icon, string> = { brain: seance.iconBrain, earth: seance.iconEarth, dice: seance.iconDice };

// The grid that gives the biggest cards in the space we have: 3 x 6 or 6 x 3.
function bestGrid(w: number, h: number) {
  let best = { cols: 3, rows: 6, cw: 0, ch: 0 };
  for (const cols of [3, 6]) {
    const rows = CARD_COUNT / cols;
    let cw = (w - GAP * (cols - 1)) / cols;
    let ch = (h - GAP * (rows - 1)) / rows;
    if (cw / ch > MAX_ASPECT) cw = ch * MAX_ASPECT;
    else if (cw / ch < MIN_ASPECT) ch = cw / MIN_ASPECT;
    if (cw * ch > best.cw * best.ch) best = { cols, rows, cw: Math.floor(cw), ch: Math.floor(ch) };
  }
  return best;
}

type CardProps = {
  icon: Icon;
  w: number;
  h: number;
  up: boolean;
  matched: boolean;
  missed: boolean;
  disabled: boolean;
  label: string;
  reduce: boolean;
  onPress: () => void;
};

// One card. It flips by squeezing to a line and opening again showing the other side.
const Card = memo(function Card({ icon, w, h, up, matched, missed, disabled, label, reduce, onPress }: CardProps) {
  const v = useRef(new Animated.Value(up ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      v.setValue(up ? 1 : 0);
      return;
    }
    Animated.timing(v, { toValue: up ? 1 : 0, duration: 200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
  }, [up, reduce, v]);

  const backScale = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const frontScale = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const size = Math.min(w, h);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{ width: w, height: h }}
    >
      {/* the back: a gold eye under a crescent moon */}
      <Animated.View style={[styles.face, styles.back, { transform: [{ scaleX: backScale }] }]}>
        <View style={styles.backFrame}>
          <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 40 40">
            <Path d="M30 6 A15 15 0 1 0 30 34 A11 11 0 1 1 30 6 Z" fill={seance.backInk} opacity={0.9} />
            <Path d="M7 21 Q20 8 33 21 Q20 34 7 21 Z" fill="none" stroke={seance.backEdge} strokeWidth={1.8} />
            <Circle cx={20} cy={21} r={4.2} fill={seance.backEdge} />
            <Circle cx={20} cy={21} r={1.6} fill={seance.backBase} />
          </Svg>
        </View>
      </Animated.View>
      {/* the front: the icon on aged parchment */}
      <Animated.View
        style={[
          styles.face,
          styles.front,
          matched && styles.frontMatched,
          missed && styles.frontMissed,
          { transform: [{ scaleX: frontScale }] },
        ]}
      >
        <MaterialCommunityIcons name={ICON_NAME[icon] as any} size={Math.floor(size * 0.58)} color={ICON_COLOUR[icon]} />
      </Animated.View>
    </Pressable>
  );
});

export function MemoryCardGame({ seed, onFinish }: GameProps) {
  const cards = useMemo(() => layout(seed), [seed]);
  const reduce = useReduceMotion();
  const [st, setSt] = useState<State>(newState);
  const stRef = useRef<State>(st);
  const [elapsed, setElapsed] = useState(0);
  const [finishedMs, setFinishedMs] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const startedAt = useRef(Date.now());
  const done = useRef(false);
  const closedTurns = useRef(0); // how many flip windows have already been closed (cards turned back)

  const commit = (next: State) => {
    stRef.current = next;
    setSt(next);
  };

  // The shared beat. Every 100 ms (smooth enough for the countdown): close the flip windows that are over
  // (a miss, or a wasted turn, turns the cards back over) and keep the clock.
  useEffect(() => {
    startedAt.current = Date.now();
    const id = setInterval(() => {
      if (done.current) return;
      const ms = Date.now() - startedAt.current;
      const b = beatAt(ms);
      while (closedTurns.current < b.turn) {
        closedTurns.current += 1;
        const next = endTurn(stRef.current);
        if (next !== stRef.current) commit(next);
      }
      if (b.turn >= MAX_TURNS) {
        // Safety cap: nobody cleared the board, so this is not a win for anybody.
        done.current = true;
        setFailed(true);
        setElapsed(ms);
        onFinish({ finished: false, totalMs: ms });
        return;
      }
      setElapsed(ms);
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beat = beatAt(elapsed);
  const flipping = beat.phase === 'flip' && !done.current && !failed && finishedMs === null;

  const onPressCard = (i: number) => {
    if (done.current) return;
    const ms = Date.now() - startedAt.current;
    const b = beatAt(ms);
    if (b.phase !== 'flip') return; // the cards only turn in the flip window
    const { state, result } = pick(stRef.current, cards, i, b.turn);
    if (result === 'ignored') return;
    commit(state);
    if (result === 'match' && isCleared(state)) {
      done.current = true;
      setElapsed(ms);
      setFinishedMs(ms);
      onFinish({ finished: true, totalMs: ms });
    }
  };

  const onArea = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea((a) => (a.w === width && a.h === height ? a : { w: width, h: height }));
  };

  const grid = useMemo(() => (area.w > 0 && area.h > 0 ? bestGrid(Math.min(area.w - 24, 520), area.h - 8) : null), [area]);
  const missed = st.picks.length === 2 && st.doneTurn === beat.turn;
  const pairs = matchedPairs(st);
  const secs = Math.max(1, Math.ceil(beat.msLeft / 1000));
  const total = beat.phase === 'ready' ? READY_MS : FLIP_MS;
  const frac = Math.max(0, Math.min(1, beat.msLeft / total));
  const ending = finishedMs !== null || failed;

  const label = ending ? (failed ? 'THE SPIRITS FALL SILENT' : 'THE VEIL IS LIFTED') : beat.phase === 'ready' ? 'BE READY' : st.doneTurn === beat.turn ? (missed ? 'NO MATCH' : 'A PAIR') : 'FLIP 2 CARDS';
  const hot = flipping && st.doneTurn !== beat.turn;

  return (
    <View style={[styles.root, { paddingBottom: FLOOR_H }]}>
      <View style={styles.hud}>
        <View style={[styles.count, hot && styles.countHot]} accessible accessibilityLabel={`${label}, ${secs}`}>
          <Text style={[styles.countText, hot && { color: seance.flameCore }]}>{ending ? '✦' : secs}</Text>
        </View>
        <View style={styles.hudMid}>
          <Text style={[styles.label, hot && { color: seance.flame }, missed && { color: seance.missTint }, ending && !failed && { color: seance.matchedGlow }]} numberOfLines={1}>
            {label}
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(ending ? 1 : frac) * 100}%`, backgroundColor: hot ? seance.flame : seance.goldDim }]} />
          </View>
        </View>
      </View>

      <View style={styles.area} onLayout={onArea}>
        {grid && (
          <View style={[styles.grid, { width: grid.cols * grid.cw + (grid.cols - 1) * GAP, gap: GAP }]}>
            {cards.map((icon, i) => {
              const matched = st.matched[i];
              const picked = st.picks.includes(i);
              return (
                <Card
                  key={i}
                  icon={icon}
                  w={grid.cw}
                  h={grid.ch}
                  up={matched || picked}
                  matched={matched}
                  missed={picked && missed}
                  disabled={!flipping || matched || picked || st.doneTurn === beat.turn}
                  label={matched ? `Card ${i + 1}, matched` : picked ? `Card ${i + 1}, flipped` : `Card ${i + 1}, face down`}
                  reduce={reduce}
                  onPress={() => onPressCard(i)}
                />
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.foot}>
        <Text style={styles.footText}>
          Pairs {pairs}/{PAIR_COUNT}
        </Text>
        {finishedMs !== null ? (
          <Text style={[styles.footText, { color: seance.matchedGlow }]}>{(finishedMs / 1000).toFixed(2)}s</Text>
        ) : (
          <Text style={styles.footText}>Turn {Math.min(beat.turn + 1, MAX_TURNS)}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 12, paddingRight: MIC_SPACE, height: HUD_H },
  count: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: seance.backBase,
    borderWidth: 2,
    borderColor: seance.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countHot: { borderColor: seance.flame, backgroundColor: '#4A2410' },
  countText: { color: seance.text, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 20, fontVariant: ['tabular-nums'] },
  hudMid: { flex: 1, gap: 5 },
  label: { color: seance.textDim, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 13, letterSpacing: 1.6 },
  track: { height: 5, borderRadius: 3, backgroundColor: seance.floor, borderWidth: 1, borderColor: seance.goldDim, overflow: 'hidden' },
  fill: { height: '100%' },

  area: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  face: { ...StyleSheet.absoluteFill, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  back: { backgroundColor: seance.backBase, borderWidth: 2, borderColor: seance.backEdge },
  backFrame: { width: '86%', height: '82%', borderRadius: 5, borderWidth: 1, borderColor: seance.backInk, alignItems: 'center', justifyContent: 'center' },
  front: { backgroundColor: seance.frontBase, borderWidth: 2, borderColor: seance.frontEdge },
  frontMatched: { borderColor: seance.matchedGlow, borderWidth: 3, backgroundColor: '#E2EFDD' },
  frontMissed: { borderColor: seance.missTint, borderWidth: 3, backgroundColor: '#E6C8BA' },

  foot: { height: FOOT_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  footText: { color: seance.text, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 13, letterSpacing: 1 },
});
