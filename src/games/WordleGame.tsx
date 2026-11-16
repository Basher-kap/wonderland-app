import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from '../components/ui';
import {
  isValidWord,
  keyStates,
  LEVEL_COUNT,
  LEVEL_NAMES,
  MAX_ATTEMPTS,
  pickAnswer,
  scoreGuess,
  tally,
  WORD_LENGTH,
} from '../game/wordle';
import type { LetterState, Outcome } from '../game/wordle';
import { colors, radius } from '../theme';
import type { GameProps } from './types';

// Wordle ("Waadoru"): 3 levels (an easy word, a moderate word, a hard word). Everybody guesses the
// same hidden 5-letter word (the seed is the same on every phone) in 5 attempts, typed with the
// on-screen keyboard. A guess that is not a real word is NOT allowed: it is rejected with a message
// and does not use up an attempt.
//
// Between levels (all in a lobby, see `room`):
//   1. a player who guessed the word, or used 5 attempts, waits for the others;
//   2. when EVERYBODY is done with the level, the answer is shown to everyone;
//   3. each player taps "Ready"; when EVERYBODY is ready a 3-2-1 countdown starts the next word.
// After the 3rd level the player's result (points + time) is reported with onFinish. Points are
// not shown here. All the rules live in src/game/wordle.ts.

const GAP = 6;
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const STATE_COLOR: Record<LetterState, string> = {
  green: '#3A9D5D',
  yellow: '#C9A227',
  gray: '#4A4A55',
};

export function WordleGame({ seed, onFinish, room }: GameProps) {
  const { width } = useWindowDimensions();
  const [level, setLevel] = useState(1);
  const answer = useMemo(() => pickAnswer(seed, level), [seed, level]);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [badRow, setBadRow] = useState(false); // the current row flashes red after a rejected guess
  const [status, setStatus] = useState<'playing' | 'solved' | 'failed'>('playing');
  const [readyFor, setReadyFor] = useState(0); // the level I tapped "Ready" after (0 = none yet)
  const [count, setCount] = useState<number | null>(null); // 3, 2, 1 before the next word
  const [sendFailed, setSendFailed] = useState(false);
  const startedAt = useRef(Date.now());
  const done = useRef(false); // this level is finished for me
  const outcomes = useRef<Outcome[]>([]);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => flashTimer.current && clearTimeout(flashTimer.current), []);

  // ---- the others (a solo practice run has no room: nobody to wait for)
  const everyoneDone =
    !room ||
    room.playerIds.every((p) => room.out.includes(p) || room.stages.some((s) => s.uid === p && s.stage === level));
  const doneCount = room
    ? room.playerIds.filter((p) => room.out.includes(p) || room.stages.some((s) => s.uid === p && s.stage === level)).length
    : 1;
  const everyoneReady =
    !room || room.playerIds.every((p) => room.out.includes(p) || (room.readyStage[p] ?? 1) >= level + 1);
  const readyCount = room
    ? room.playerIds.filter((p) => room.out.includes(p) || (room.readyStage[p] ?? 1) >= level + 1).length
    : 1;

  const finished = status !== 'playing';
  const lastLevel = level >= LEVEL_COUNT;

  // ---- starting the next word: everybody is ready -> 3-2-1 -> new board
  useEffect(() => {
    if (!finished || !everyoneDone || lastLevel || readyFor !== level || !everyoneReady) return;
    setCount(3);
    const timers = [
      setTimeout(() => setCount(2), 1000),
      setTimeout(() => setCount(1), 2000),
      setTimeout(() => {
        setCount(null);
        setLevel((l) => l + 1);
        setGuesses([]);
        setCurrent('');
        setMessage(null);
        setStatus('playing');
        done.current = false;
        startedAt.current = Date.now();
      }, 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [finished, everyoneDone, lastLevel, readyFor, level, everyoneReady]);

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

  // This level is over for me: tell the others, and after the last level report the whole game.
  const finishLevel = (solved: boolean) => {
    const ms = Date.now() - startedAt.current;
    done.current = true;
    outcomes.current[level - 1] = { solved, ms };
    setStatus(solved ? 'solved' : 'failed');
    if (room) {
      room.reportStage(level, { solved, ms }).catch(() => setSendFailed(true));
    }
    if (level === LEVEL_COUNT) {
      const { score, totalMs } = tally(outcomes.current);
      onFinish({ finished: true, totalMs, score });
    }
  };

  const submit = () => {
    if (done.current) return;
    if (current.length < WORD_LENGTH) return reject('Not enough letters');
    if (!isValidWord(current)) return reject('Not a valid word. Try another one.');

    const next = [...guesses, current];
    setGuesses(next);
    setCurrent('');
    setMessage(null);

    if (current === answer) finishLevel(true);
    else if (next.length >= MAX_ATTEMPTS) finishLevel(false);
  };

  const retrySend = () => {
    const o = outcomes.current[level - 1];
    if (!room || !o) return;
    setSendFailed(false);
    room.reportStage(level, o).catch(() => setSendFailed(true));
  };

  const tapReady = () => {
    setReadyFor(level);
    if (room) room.readyFor(level + 1).catch(() => setReadyFor(0));
  };

  const cell = Math.min(54, Math.floor((width - 40 - GAP * (WORD_LENGTH - 1)) / WORD_LENGTH));
  const keyW = Math.floor((width - 32 - 4 * (KEY_ROWS[0].length - 1)) / KEY_ROWS[0].length);
  const keys = useMemo(() => keyStates(guesses, answer), [guesses, answer]);

  const rows: { letters: string; states: LetterState[] | null; active: boolean }[] = [];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (i < guesses.length) rows.push({ letters: guesses[i], states: scoreGuess(guesses[i], answer), active: false });
    else if (i === guesses.length && status === 'playing') rows.push({ letters: current, states: null, active: true });
    else rows.push({ letters: '', states: null, active: false });
  }

  const nameOf = (uid: string) => room?.usernames[uid] ?? 'Player';

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Level {level}/{LEVEL_COUNT} · {LEVEL_NAMES[level - 1]} word
        </Text>
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

      {/* Playing: the keyboard */}
      {status === 'playing' && (
        <View style={styles.keyboard}>
          {KEY_ROWS.map((letters, i) => (
            <View key={letters} style={styles.keyRow}>
              {i === 2 && (
                <Pressable onPress={submit} accessibilityRole="button" style={[styles.key, styles.keyWide, { height: 48 }]}>
                  <Text style={styles.keyText}>ENTER</Text>
                </Pressable>
              )}
              {letters.split('').map((l) => (
                <Pressable
                  key={l}
                  onPress={() => press(l)}
                  accessibilityRole="button"
                  style={[styles.key, { width: keyW, height: 48 }, keys[l] && { backgroundColor: STATE_COLOR[keys[l]] }]}
                >
                  <Text style={styles.keyText}>{l.toUpperCase()}</Text>
                </Pressable>
              ))}
              {i === 2 && (
                <Pressable onPress={erase} accessibilityRole="button" style={[styles.key, styles.keyWide, { height: 48 }]}>
                  <Text style={styles.keyText}>⌫</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Finished this level, others still playing */}
      {finished && !everyoneDone && (
        <View style={styles.panel}>
          <Text style={[styles.panelTitle, { color: status === 'solved' ? STATE_COLOR.green : colors.text }]}>
            {status === 'solved' ? 'You guessed it!' : 'Out of attempts.'}
          </Text>
          <Text style={styles.panelText}>
            Waiting for the other players to finish… ({doneCount}/{room?.playerIds.length ?? 1} done)
          </Text>
          {sendFailed && <Button label="Send again" variant="secondary" onPress={retrySend} />}
        </View>
      )}

      {/* Everybody is done with this level: show the answer to all */}
      {finished && everyoneDone && (
        <View style={[styles.panel, styles.reveal]}>
          <Text style={styles.panelText}>The {LEVEL_NAMES[level - 1].toLowerCase()} word was</Text>
          <Text style={styles.answer}>{answer.toUpperCase()}</Text>
          {room &&
            room.playerIds.map((p) => {
              const s = room.stages.find((x) => x.uid === p && x.stage === level);
              return (
                <Text key={p} style={styles.panelText}>
                  {s ? (s.solved ? '✓' : '✗') : '–'} {nameOf(p)}
                </Text>
              );
            })}

          {lastLevel ? (
            <Text style={styles.panelText}>That was the last word. Finishing the game…</Text>
          ) : count !== null ? (
            <>
              <Text style={styles.panelText}>Next word in</Text>
              <Text style={styles.countdown}>{count}</Text>
            </>
          ) : readyFor === level ? (
            <Text style={styles.panelText}>
              Waiting for the other players to be ready… ({readyCount}/{room?.playerIds.length ?? 1})
            </Text>
          ) : (
            <Button label={`Ready for the ${LEVEL_NAMES[level].toLowerCase()} word`} onPress={tapReady} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
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
  panel: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
    alignItems: 'center',
  },
  reveal: { borderColor: colors.accent, borderWidth: 2 },
  panelTitle: { fontSize: 18, fontWeight: '800' },
  panelText: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  answer: { color: colors.accent, fontSize: 32, fontWeight: '800', letterSpacing: 4 },
  countdown: { color: colors.text, fontSize: 56, fontWeight: '800', textAlign: 'center' },
});
