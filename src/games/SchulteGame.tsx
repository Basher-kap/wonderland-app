import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { arrange, GRID_COLUMNS, LEVEL_COUNT, levelCells, levelDirection, tap, tapOrder } from '../game/schulte';
import { BUNTING_H, FLOOR_H, displayWeight, FONT_DISPLAY, kids } from '../gameThemes/schulte';
import type { GameProps } from './types';

// Schulte Table ("Shurute Hyou"): 5 levels, tap the cells in ascending order.
// The numbers of each level come from `seed`, so every player gets the same first grid.
// A wrong tap does NOT change the grid or the progress: the tapped cell just blinks red as a
// warning (and the Misses counter goes up). The clock runs from the moment the board appears
// until the 5th level is cleared, so wrong taps only cost time. All the rules live in
// src/game/schulte.ts; this file is only the screen.
//
// THE LOOK (children's home, see gameThemes/schulte/theme.ts): the room (striped wall, bunting, sun
// rays, floor) is the screen background, drawn by OrphanageBackground; this file draws the clock, the
// level, and the numbers as toy blocks in a wooden tray. The game is registered as `fullScreen`, so
// GameScreen gives it the whole screen with no ScrollView. The tray is sized from the space it is
// given (onLayout), so even the 50 blocks of level 4 stay inside the frame.

const GAP = 6;
const FRAME = 7; // the wooden rim of the tray
const MAT = 8; // the felt between the rim and the blocks
const MAT_BORDER = 2; // the dashed stitching around the felt (styles.mat borderWidth)
const RIM = (FRAME + MAT + MAT_BORDER) * 2; // rim, felt and stitching, both sides: what the tray adds to the grid
const MIC_SPACE = 128; // the lobby's mic pill floats in the top-right corner (VoiceButton): keep clear
const CAPTION_H = 38;
const pad = (n: number) => String(n).padStart(2, '0');
const clock = (ms: number) => `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}.${Math.floor((ms % 1000) / 100)}`;

export function SchulteGame({ seed, uid, onFinish }: GameProps) {
  const [level, setLevel] = useState(1);
  const [wrong, setWrong] = useState<{ value: number; on: boolean } | null>(null); // red blink
  const [tapped, setTapped] = useState(0); // correct taps so far on this level
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [finishedMs, setFinishedMs] = useState<number | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 }); // the space between the clock row and the floor
  const startedAt = useRef(Date.now());
  const done = useRef(false);
  const blinkTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearBlink = () => {
    blinkTimers.current.forEach(clearTimeout);
    blinkTimers.current = [];
  };

  // Blink the wrong cell red 3 times (on/off every 110 ms), then go back to normal.
  const blink = (value: number) => {
    clearBlink();
    setWrong({ value, on: true });
    for (let i = 1; i <= 5; i++) {
      blinkTimers.current.push(
        setTimeout(() => setWrong(i === 5 ? null : { value, on: i % 2 === 0 }), i * 110)
      );
    }
  };

  useEffect(() => clearBlink, []);

  useEffect(() => {
    startedAt.current = Date.now();
    const id = setInterval(() => {
      if (!done.current) setElapsed(Date.now() - startedAt.current);
    }, 100);
    return () => clearInterval(id);
  }, []);

  const levelSeed = `${seed}:L${level}`;
  const cells = useMemo(() => levelCells(level, levelSeed), [level, levelSeed]);
  const order = useMemo(() => tapOrder(cells, level), [cells, level]); // the order to tap them in
  // The same arrangement for everybody, and it never changes during a level.
  const grid = useMemo(() => arrange(cells, `${levelSeed}:a0`), [cells, levelSeed]);

  const onPressCell = (value: number) => {
    if (done.current) return;
    const result = tap(cells, tapped, value, level);
    if (result === 'wrong') {
      setMistakes((m) => m + 1);
      blink(value);
    } else if (result === 'correct') {
      setTapped((t) => t + 1);
    } else if (level < LEVEL_COUNT) {
      clearBlink();
      setWrong(null);
      setLevel((l) => l + 1);
      setTapped(0);
    } else {
      done.current = true;
      const total = Date.now() - startedAt.current;
      setElapsed(total);
      setFinishedMs(total);
      onFinish({ finished: true, totalMs: total });
    }
  };

  const onArea = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea((a) => (a.w === width && a.h === height ? a : { w: width, h: height }));
  };

  // The tray: 5 blocks across. Its width is whatever the screen gives (up to 520), and the height of
  // the blocks shrinks, if it must, so that all the rows (10 on level 4) fit between the clock row and
  // the caption. Nothing here ever needs a scroll.
  const cols = GRID_COLUMNS;
  const rows = Math.ceil(grid.length / cols);
  const availW = Math.min(area.w - 24, 520);
  const availH = area.h - CAPTION_H - 8;
  const cellW = Math.max(20, Math.floor((availW - RIM - GAP * (cols - 1)) / cols));
  const cellH = Math.max(26, Math.min(cellW, Math.floor((availH - RIM - 5 - GAP * (rows - 1)) / rows)));
  const trayW = cols * cellW + GAP * (cols - 1) + RIM;
  const isEquation = level === 5;
  const fontSize = isEquation
    ? Math.round(Math.max(11, Math.min(cellH * 0.42, cellW * 0.27)))
    : Math.round(Math.max(13, Math.min(cellH * 0.56, cellW * 0.44)));
  const clearedValues = useMemo(() => new Set(order.slice(0, tapped)), [order, tapped]);
  const descending = levelDirection(level) === 'desc';
  const hint = descending
    ? 'Descending order: start from the biggest number!'
    : isEquation
    ? 'Work out each sum, then tap the answers in order.'
    : '';

  return (
    <View style={[styles.root, { paddingTop: BUNTING_H + 6, paddingBottom: FLOOR_H + 4 }]}>
      <View style={styles.hud}>
        <View style={styles.tag} accessible accessibilityLabel="Time">
          <Text style={styles.clock}>{clock(elapsed)}</Text>
        </View>
        <View style={styles.tag} accessible accessibilityLabel={`Level ${Math.min(level, LEVEL_COUNT)} of ${LEVEL_COUNT}`}>
          <Text style={styles.tagText}>
            Level {Math.min(level, LEVEL_COUNT)}/{LEVEL_COUNT}
          </Text>
          <View style={styles.dots}>
            {Array.from({ length: LEVEL_COUNT }, (_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i < level ? kids.blocks[i].base : 'transparent', borderColor: kids.blocks[i].base }]} />
            ))}
          </View>
        </View>
      </View>

      <View style={styles.area} onLayout={onArea}>
        {area.w > 0 && finishedMs === null && (
          <View style={styles.trayHolder}>
            <View style={[styles.tray, { width: trayW }]}>
              <View style={styles.mat}>
                <View style={[styles.grid, { gap: GAP }]}>
                  {grid.map((cell, i) => {
                    const cleared = clearedValues.has(cell.value);
                    const red = wrong?.on === true && wrong.value === cell.value;
                    const tone = kids.blocks[i % kids.blocks.length];
                    return (
                      <Pressable
                        key={cell.id}
                        onPress={() => onPressCell(cell.value)}
                        disabled={cleared}
                        accessibilityRole="button"
                        accessibilityLabel={cell.label}
                        accessibilityState={{ disabled: cleared }}
                        style={({ pressed }) => [
                          styles.block,
                          { width: cellW, height: cellH, backgroundColor: tone.face, borderBottomColor: tone.base },
                          cleared && styles.blockCleared,
                          red && styles.blockWrong,
                          pressed && !cleared && { transform: [{ translateY: 2 }], borderBottomWidth: 1 },
                        ]}
                      >
                        <Text
                          style={[styles.blockText, { fontSize }, cleared && { opacity: 0.4 }, red && { color: '#FFFFFF' }]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          {cell.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        )}
        {finishedMs !== null && (
          <View style={styles.finished}>
            <Text style={styles.finishedTitle}>Cleared!</Text>
            <Text style={styles.finishedTime}>{clock(finishedMs)}</Text>
          </View>
        )}

        {/* One line under the tray: wrong taps on the left, the instruction (if the level has one) on the right. */}
        <View style={[styles.caption, { width: area.w > 0 ? Math.max(trayW, 200) : '100%' }]}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>Misses {mistakes}</Text>
          </View>
          <Text style={styles.hint} numberOfLines={2}>
            {hint}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: MIC_SPACE, height: 46 },
  tag: {
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: kids.paper,
    borderWidth: 2,
    borderColor: kids.paperEdge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clock: { color: kids.ink, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 18, fontVariant: ['tabular-nums'] },
  tagText: { color: kids.ink, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 14 },
  dots: { flexDirection: 'row', gap: 3, marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5 },

  area: { flex: 1, alignItems: 'center' },
  trayHolder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tray: {
    padding: FRAME,
    borderRadius: 22,
    backgroundColor: kids.frame,
    borderTopWidth: 2,
    borderTopColor: kids.frameLight,
    borderBottomWidth: 5,
    borderBottomColor: kids.frameBase,
  },
  mat: {
    padding: MAT,
    borderRadius: 14,
    backgroundColor: kids.mat,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: kids.matStitch,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  block: {
    borderRadius: 8,
    borderBottomWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  blockCleared: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,243,214,0.55)',
  },
  blockWrong: { backgroundColor: kids.wrong, borderBottomColor: kids.wrongBase },
  blockText: { color: kids.ink, fontFamily: FONT_DISPLAY, fontWeight: displayWeight },

  caption: { height: CAPTION_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 },
  hint: { flex: 1, color: kids.ink, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 13, textAlign: 'right' },

  finished: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  finishedTitle: { color: kids.title, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 30 },
  finishedTime: { color: kids.ink, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 40, fontVariant: ['tabular-nums'] },
});
