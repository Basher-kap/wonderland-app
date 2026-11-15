import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { arrange, GRID_COLUMNS, LEVEL_COUNT, levelCells, tap } from '../game/schulte';
import { colors, radius } from '../theme';
import type { GameProps } from './types';

// Schulte Table ("Shurute Hyou"): 5 levels, tap the cells in ascending order.
// The numbers of each level come from `seed`, so every player gets the same first grid.
// A wrong tap reshuffles the SAME cells into a new arrangement and restarts the level.
// The clock runs from the moment the board appears until the 5th level is cleared (wrong
// taps cost time). All the rules live in src/game/schulte.ts; this file is only the screen.

const GAP = 6;
const pad = (n: number) => String(n).padStart(2, '0');
const clock = (ms: number) => `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}.${Math.floor((ms % 1000) / 100)}`;

export function SchulteGame({ seed, uid, onFinish }: GameProps) {
  const { width, height } = useWindowDimensions();
  const [level, setLevel] = useState(1);
  const [attempt, setAttempt] = useState(0); // grows with every wrong tap on this level
  const [tapped, setTapped] = useState(0); // correct taps so far on this level
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [finishedMs, setFinishedMs] = useState<number | null>(null);
  const startedAt = useRef(Date.now());
  const done = useRef(false);

  useEffect(() => {
    startedAt.current = Date.now();
    const id = setInterval(() => {
      if (!done.current) setElapsed(Date.now() - startedAt.current);
    }, 100);
    return () => clearInterval(id);
  }, []);

  const levelSeed = `${seed}:L${level}`;
  const cells = useMemo(() => levelCells(level, levelSeed), [level, levelSeed]);
  const sorted = useMemo(() => cells.map((c) => c.value).sort((a, b) => a - b), [cells]);
  const grid = useMemo(
    () => arrange(cells, attempt === 0 ? `${levelSeed}:a0` : `${levelSeed}:${uid}:a${attempt}`),
    [cells, levelSeed, uid, attempt]
  );

  const onPressCell = (value: number) => {
    if (done.current) return;
    const result = tap(cells, tapped, value);
    if (result === 'wrong') {
      setAttempt((a) => a + 1);
      setTapped(0);
      setMistakes((m) => m + 1);
    } else if (result === 'correct') {
      setTapped((t) => t + 1);
    } else if (level < LEVEL_COUNT) {
      setLevel((l) => l + 1);
      setAttempt(0);
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
  const doneUpTo = tapped > 0 ? sorted[tapped - 1] : -Infinity;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Level {Math.min(level, LEVEL_COUNT)}/{LEVEL_COUNT}
        </Text>
        <Text style={[styles.headerText, styles.clock]}>{clock(elapsed)}</Text>
        <Text style={styles.headerText}>Misses {mistakes}</Text>
      </View>

      {finishedMs === null ? (
        <View style={styles.grid}>
          {grid.map((cell) => {
            const cleared = cell.value <= doneUpTo;
            return (
              <Pressable
                key={`${attempt}-${cell.id}`}
                onPress={() => onPressCell(cell.value)}
                disabled={cleared}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.cell,
                  { width: cellW, height: cellH },
                  cleared && styles.cellCleared,
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
  cellText: { color: colors.text, fontWeight: '700' },
  finished: { alignItems: 'center', gap: 6, paddingVertical: 30 },
  finishedTitle: { color: colors.experience, fontSize: 28, fontWeight: '800' },
  finishedTime: { color: colors.text, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
