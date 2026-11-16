import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  isValidWord,
  keyStates,
  MAX_ATTEMPTS,
  pickAnswer,
  scoreGuess,
  WORD_LENGTH,
} from '../game/wordle';
import type { LetterState } from '../game/wordle';
import { colors, radius } from '../theme';
import type { GameProps } from './types';

// Wordle ("Waadoru"): everybody guesses the same hidden 5-letter word (the seed is the same on
// every phone) in 5 attempts. Typed with the on-screen keyboard. A guess that is not a real word
// is NOT allowed: it is rejected with a message and does not use up an attempt.
// When the player solves it (or runs out of attempts) the result is reported with onFinish. The
// hidden word is NOT shown here: it is revealed in the round summary once the round is over,
// so a player who failed cannot pass the answer on. All the rules live in src/game/wordle.ts.

const GAP = 6;
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const STATE_COLOR: Record<LetterState, string> = {
  green: '#3A9D5D',
  yellow: '#C9A227',
  gray: '#4A4A55',
};

export function WordleGame({ seed, onFinish }: GameProps) {
  const { width } = useWindowDimensions();
  const answer = useMemo(() => pickAnswer(seed), [seed]);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [badRow, setBadRow] = useState(false); // the current row flashes red after a rejected guess
  const [status, setStatus] = useState<'playing' | 'solved' | 'failed'>('playing');
  const startedAt = useRef(Date.now());
  const done = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reject = (text: string) => {
    setMessage(text);
    setBadRow(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setBadRow(false), 500);
  };

  const press = (letter: string) => {
    if (done.current || current.length >= WORD_LENGTH) return;
    setMessage(null);
    setCurrent((c) => c + letter);
  };

  const erase = () => {
    if (done.current) return;
    setMessage(null);
    setCurrent((c) => c.slice(0, -1));
  };

  const submit = () => {
    if (done.current) return;
    if (current.length < WORD_LENGTH) return reject('Not enough letters');
    if (!isValidWord(current)) return reject('Not a valid word. Try another one.');

    const next = [...guesses, current];
    setGuesses(next);
    setCurrent('');
    setMessage(null);

    const totalMs = Date.now() - startedAt.current;
    if (current === answer) {
      done.current = true;
      setStatus('solved');
      onFinish({ finished: true, totalMs, attempts: next.length });
    } else if (next.length >= MAX_ATTEMPTS) {
      done.current = true;
      setStatus('failed');
      onFinish({ finished: false, totalMs, attempts: next.length });
    }
  };

  const cell = Math.min(58, Math.floor((width - 40 - GAP * (WORD_LENGTH - 1)) / WORD_LENGTH));
  const keyW = Math.floor((width - 32 - 4 * (KEY_ROWS[0].length - 1)) / KEY_ROWS[0].length);
  const keys = useMemo(() => keyStates(guesses, answer), [guesses, answer]);

  const rows: { letters: string; states: LetterState[] | null; active: boolean }[] = [];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (i < guesses.length) rows.push({ letters: guesses[i], states: scoreGuess(guesses[i], answer), active: false });
    else if (i === guesses.length && status === 'playing') rows.push({ letters: current, states: null, active: true });
    else rows.push({ letters: '', states: null, active: false });
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Attempt {Math.min(guesses.length + (status === 'playing' ? 1 : 0), MAX_ATTEMPTS)}/{MAX_ATTEMPTS}
        </Text>
      </View>

      <View style={styles.board}>
        {rows.map((row, r) => (
          <View key={r} style={styles.row}>
            {Array.from({ length: WORD_LENGTH }, (_, c) => {
              const letter = row.letters[c] ?? '';
              const state = row.states?.[c];
              return (
                <View
                  key={c}
                  style={[
                    styles.cell,
                    { width: cell, height: cell },
                    state && { backgroundColor: STATE_COLOR[state], borderColor: STATE_COLOR[state] },
                    row.active && letter !== '' && styles.cellTyped,
                    row.active && badRow && styles.cellBad,
                  ]}
                >
                  <Text style={styles.cellText}>{letter.toUpperCase()}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {message && <Text style={styles.message}>{message}</Text>}
      {status === 'solved' && <Text style={[styles.message, { color: STATE_COLOR.green }]}>Solved!</Text>}
      {status === 'failed' && <Text style={styles.message}>Out of attempts.</Text>}

      {status === 'playing' && (
        <View style={styles.keyboard}>
          {KEY_ROWS.map((letters, i) => (
            <View key={letters} style={styles.keyRow}>
              {i === 2 && (
                <Pressable
                  onPress={submit}
                  accessibilityRole="button"
                  style={[styles.key, styles.keyWide, { height: 48 }]}
                >
                  <Text style={styles.keyText}>ENTER</Text>
                </Pressable>
              )}
              {letters.split('').map((l) => (
                <Pressable
                  key={l}
                  onPress={() => press(l)}
                  accessibilityRole="button"
                  style={[
                    styles.key,
                    { width: keyW, height: 48 },
                    keys[l] && { backgroundColor: STATE_COLOR[keys[l]] },
                  ]}
                >
                  <Text style={styles.keyText}>{l.toUpperCase()}</Text>
                </Pressable>
              ))}
              {i === 2 && (
                <Pressable
                  onPress={erase}
                  accessibilityRole="button"
                  style={[styles.key, styles.keyWide, { height: 48 }]}
                >
                  <Text style={styles.keyText}>⌫</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'center' },
  headerText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  board: { alignItems: 'center', gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  cell: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellTyped: { borderColor: colors.muted },
  cellBad: { borderColor: '#FF5252', backgroundColor: '#4A1F1F' },
  cellText: { color: colors.text, fontSize: 26, fontWeight: '800' },
  message: { color: colors.logic, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  keyboard: { gap: 6, alignItems: 'center' },
  keyRow: { flexDirection: 'row', gap: 4, justifyContent: 'center' },
  key: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyWide: { paddingHorizontal: 10, minWidth: 52 },
  keyText: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
