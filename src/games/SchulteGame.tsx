import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { arrange, GRID_COLUMNS, LEVEL_COUNT, levelCells, levelDirection, tap, tapOrder } from '../game/schulte';
import { colors, radius } from '../theme';
import type { GameProps } from './types';

// Schulte Table ("Shurute Hyou"): 5 levels, tap the cells in ascending order.
// The numbers of each level come from `seed`, so every player gets the same first grid.
// A wrong tap does NOT change the grid or the progress: the tapped cell just blinks red as a
// warning (and the Misses counter goes up). The clock runs from the moment the board appears
// until the 5th level is cleared, so wrong taps only cost time. All the rules live in
// src/game/schulte.ts; this file is only the screen.

const GAP = 6;
const pad = (n: number) => String(n).padStart(2, '0');
const clock = (ms: number) => `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}.${Math.floor((ms % 1000) / 100)}`;

export function SchulteGame({ seed, uid, onFinish }: GameProps) {
  const { width, height } = useWindowDimensions();
  const [level, setLevel] = useState(1);
  const [wrong, setWrong] = useState<{ value: number; on: boolean } | null>(null); // red blink
  const [tapped, setTapped] = useState(0); // correct taps so far on this level
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [finishedMs, setFinishedMs] = useState<number | null>(null);
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

  // Cell size: 5 columns across, but shrink the height so 10 rows (level 4) still fit.
  const cols = GRID_COLUMNS;
  const rows = Math.ceil(grid.length / cols);
  const cellW = Math.floor((width - 32 - GAP * (cols - 1)) / cols);
  const cellH = Math.max(34, Math.min(cellW, Math.floor((height - 330 - GAP * (rows - 1)) / rows)));
  const isEquation = level === 5;
  const fontSize = isEquation ? 14 : level >= 3 ? 18 : 22;
  const clearedValues = useMemo(() => new Set(order.slice(0, tapped)), [order, tapped]);
  const descending = levelDirection(level) === 'desc';

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Level {Math.min(level, LEVEL_COUNT)}/{LEVEL_COUNT}
        </Text>
        <Text style={[styles.headerText, styles.clock]}>{clock(elapsed)}</Text>
        <Text style={styles.headerText}>Misses {mistakes}</Text>
      </View>

      {descending && finishedMs === null && (
        <Text style={styles.hint}>Descending order: start from the biggest number!</Text>
      )}

      {finishedMs === null ? (
        <View style={styles.grid}>
          {grid.map((cell) => {
            const cleared = clearedValues.has(cell.value);
            const red = wrong?.on === true && wrong.value === cell.value;
            return (
              <Pressable
                key={cell.id}
                onPress={() => onPressCell(cell.value)}
                disabled={cleared}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.cell,
                  { width: cellW, height: cellH },
                  cleared && styles.cellCleared,
                  red && styles.cellWrong,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[styles.cellText, { fontSize }, cleared && { color: colors.muted }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {cell.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.finished}>
          <Text style={styles.finishedTitle}>Cleared!</Text>
          <Text style={styles.finishedTime}>{clock(finishedMs)}</Text>
          <Text style={styles.headerText}>{mistakes} wrong tap{mistakes === 1 ? '' : 's'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.experience, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  clock: { color: colors.text, fontSize: 22, fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.experience,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  cellCleared: { backgroundColor: colors.bg, borderColor: colors.border },
  cellWrong: { backgroundColor: '#C62828', borderColor: '#FF5252' },
  cellText: { color: colors.text, fontWeight: '700' },
  finished: { alignItems: 'center', gap: 6, paddingVertical: 30 },
  finishedTitle: { color: colors.experience, fontSize: 28, fontWeight: '800' },
  finishedTime: { color: colors.text, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
