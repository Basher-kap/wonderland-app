import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button } from '../components';
import { useGameSounds } from '../audio';
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
import { FONT_BODY, FONT_TILE, tileWeight, wordle as w } from '../gameThemes/wordle';
import type { GameProps } from './types';

// Wordle ("Waadoru"): 3 levels (an easy word, a moderate word, a hard word). Everybody guesses the
// same hidden 5-letter word (the seed is the same on every phone) in 5 attempts, typed with the
// on-screen keyboard. A guess that is not a real word is NOT allowed: it is rejected with a message
// and does not use up an attempt.
//
// RACE: nobody waits for anybody. A player who guessed the word, or used 5 attempts, sees the answer for
// a moment and then goes straight on to the next word. The game lasts until every player has finished
// all the levels; the most points wins (a tie goes to the shorter total time). In a lobby each player's progress
// (levels done) is shown under the header, from `room.stages`.
//
// After the 3rd level the player's result (points + time) is reported with onFinish. Points are
// not shown here. All the rules live in src/game/wordle.ts.
//
// LOOK: a reading room after hours (gameThemes/wordle/theme.ts). The bookshelves, the lamp and
// the rules dialogs are in gameThemes/wordle/LibraryBackground.tsx and gameThemes/wordle/intro.tsx. A correct letter hangs a
// bookmark ribbon, a letter in the wrong spot gets a folded corner, a letter that is not in the word
// is dimmed, so the result never depends on colour alone. A guess turns over one tile at a time.

const GAP = 6;
const FLIP_MS = 260;
const REVEAL_MS = 2200; // how long the answer shows before the next word starts
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const STATE_STYLE: Record<LetterState, { bg: string; text: string }> = {
  green: w.correct,
  yellow: w.present,
  gray: w.absent,
};

// ---- one letter tile: turns over like a page when its result arrives
function Tile({
  letter,
  state,
  size,
  typed,
  bad,
  delay,
  reduceMotion,
}: {
  letter: string;
  state?: LetterState;
  size: number;
  typed: boolean;
  bad: boolean;
  delay: number;
  reduceMotion: boolean;
}) {
  const [shown, setShown] = useState<LetterState | undefined>(state);
  const prev = useRef<LetterState | undefined>(state);
  const flip = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!state) {
      prev.current = undefined;
      flip.setValue(0);
      setShown(undefined);
      return;
    }
    if (prev.current === state || reduceMotion) {
      prev.current = state;
      setShown(state);
      return;
    }
    prev.current = state;
    flip.setValue(0);
    const swap = setTimeout(() => setShown(state), delay + FLIP_MS / 2);
    Animated.sequence([Animated.delay(delay), Animated.timing(flip, { toValue: 1, duration: FLIP_MS, useNativeDriver: true })]).start();
    return () => clearTimeout(swap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const look = shown ? STATE_STYLE[shown] : null;
  const scaleX = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.06, 1] });
  const fold = Math.max(10, Math.round(size * 0.26));

  return (
    <Animated.View
      style={[
        styles.tile,
        { width: size, height: size, transform: [{ scaleX }] },
        typed && styles.tileTyped,
        bad && styles.tileBad,
        look && { backgroundColor: look.bg, borderColor: look.bg },
      ]}
    >
      <Text style={[styles.tileText, { fontSize: Math.round(size * 0.52) }, look && { color: look.text }, shown === 'gray' && { opacity: 0.85 }]}>
        {letter.toUpperCase()}
      </Text>

      {/* correct: a bookmark ribbon hangs off the top edge */}
      {shown === 'green' && (
        <View pointerEvents="none" style={[styles.ribbon, { left: size / 2 - 5 }]}>
          <View style={[styles.ribbonNotch, { borderBottomColor: w.correct.bg }]} />
        </View>
      )}

      {/* wrong spot: the top-right corner is folded over */}
      {shown === 'yellow' && (
        <>
          <View pointerEvents="none" style={[styles.cut, { top: -2, right: -2, borderTopWidth: fold + 2, borderLeftWidth: fold + 2 }]} />
          <View pointerEvents="none" style={[styles.fold, { top: 0, right: 0, borderBottomWidth: fold, borderRightWidth: fold }]} />
        </>
      )}
    </Animated.View>
  );
}

export function WordleGame({ seed, onFinish, room }: GameProps) {
  const { width } = useWindowDimensions();
  const { play } = useGameSounds('wordle'); // loads the sounds now, frees them when the game closes
  const soundTimers = useRef<ReturnType<typeof setTimeout>[]>([]); // the tile sounds of the guess being revealed
  const [level, setLevel] = useState(1);
  const answer = useMemo(() => pickAnswer(seed, level), [seed, level]);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [badRow, setBadRow] = useState(false); // the current row flashes red after a rejected guess
  const [status, setStatus] = useState<'playing' | 'solved' | 'failed'>('playing');
  const [sendFailed, setSendFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const startedAt = useRef(Date.now());
  const done = useRef(false); // this level is finished for me
  const outcomes = useRef<Outcome[]>([]);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      soundTimers.current.forEach(clearTimeout);
    },
    []
  );
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const finished = status !== 'playing';
  const lastLevel = level >= LEVEL_COUNT;

  // ---- the others: how many levels each player has finished (a solo practice run has no room)
  const progress = room
    ? room.playerIds.map((p) => ({
        uid: p,
        done: room.stages.filter((s) => s.uid === p).length,
        out: room.out.includes(p),
      }))
    : [];

  // The answer stays on screen for a moment, then the next word starts: nobody waits for the others.
  const goToNextLevel = () => {
    setLevel((l) => l + 1);
    setGuesses([]);
    setCurrent('');
    setMessage(null);
    setStatus('playing');
    done.current = false;
    startedAt.current = Date.now();
  };

  const reject = (text: string) => {
    play('invalid');
    setMessage(text);
    setBadRow(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setBadRow(false), 500);
  };

  const press = (letter: string) => {
    if (done.current || current.length >= WORD_LENGTH) return;
    play('key');
    setMessage(null);
    setCurrent((c) => c + letter);
  };

  const erase = () => {
    if (done.current) return;
    if (current.length > 0) play('erase');
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
    } else {
      advanceTimer.current = setTimeout(goToNextLevel, REVEAL_MS);
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

    // The sounds follow the tiles: each one is heard as it turns over (see Tile), then the verdict.
    const states = scoreGuess(current, answer);
    const sound = { green: 'tileGreen', yellow: 'tileYellow', gray: 'tileGray' } as const;
    states.forEach((st, c) => soundTimers.current.push(setTimeout(() => play(sound[st]), c * 140 + FLIP_MS / 2)));
    const verdict = current === answer ? 'solved' : next.length >= MAX_ATTEMPTS ? 'failed' : null;
    if (verdict) soundTimers.current.push(setTimeout(() => play(verdict), (WORD_LENGTH - 1) * 140 + FLIP_MS + 80));

    if (current === answer) finishLevel(true);
    else if (next.length >= MAX_ATTEMPTS) finishLevel(false);
  };

  const retrySend = () => {
    const o = outcomes.current[level - 1];
    if (!room || !o) return;
    setSendFailed(false);
    room.reportStage(level, o).catch(() => setSendFailed(true));
  };

  // screen padding 20+20, blotter padding 10+10 and border 2+2
  const cell = Math.min(54, Math.floor((width - 64 - GAP * (WORD_LENGTH - 1)) / WORD_LENGTH));
  const keyW = Math.floor((width - 40 - 3 * (KEY_ROWS[0].length - 1)) / KEY_ROWS[0].length);
  const keys = useMemo(() => keyStates(guesses, answer), [guesses, answer]);

  const rows: { letters: string; states: LetterState[] | null; active: boolean }[] = [];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (i < guesses.length) rows.push({ letters: guesses[i], states: scoreGuess(guesses[i], answer), active: false });
    else if (i === guesses.length && status === 'playing') rows.push({ letters: current, states: null, active: true });
    else rows.push({ letters: '', states: null, active: false });
  }

  const nameOf = (uid: string) => room?.usernames[uid] ?? 'Player';
  const attempt = Math.min(guesses.length + (status === 'playing' ? 1 : 0), MAX_ATTEMPTS);

  const scene = (
    <>
      <View style={styles.header} accessible accessibilityLabel={`Level ${level} of ${LEVEL_COUNT}, ${LEVEL_NAMES[level - 1]} word. Attempt ${attempt} of ${MAX_ATTEMPTS}`}>
        <View style={styles.bookmark}>
          <Text style={styles.bookmarkSmall}>Level</Text>
          <Text style={styles.bookmarkBig}>
            {level} of {LEVEL_COUNT}
          </Text>
        </View>
        <Text style={styles.headerWord}>{LEVEL_NAMES[level - 1]} word</Text>
        <Text style={styles.headerAttempt}>
          Attempt {attempt} of {MAX_ATTEMPTS}
        </Text>
      </View>

      {progress.length > 1 && (
        <Text style={styles.progress} accessibilityLabel="Progress of the players">
          {progress.map((p) => `${nameOf(p.uid)} ${p.out ? 'out' : `${p.done}/${LEVEL_COUNT}`}`).join('  ·  ')}
        </Text>
      )}

      <View style={styles.blotter}>
        {rows.map((row, r) => (
          <View key={r} style={styles.row}>
            {Array.from({ length: WORD_LENGTH }, (_, c) => (
              <Tile
                key={c}
                letter={row.letters[c] ?? ''}
                state={row.states?.[c]}
                size={cell}
                typed={row.active && (row.letters[c] ?? '') !== ''}
                bad={row.active && badRow}
                delay={c * 140}
                reduceMotion={reduceMotion}
              />
            ))}
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
                <Pressable onPress={submit} accessibilityRole="button" accessibilityLabel="Enter" style={[styles.key, styles.keyWide, { height: 48 }]}>
                  <Text style={styles.keyTextSmall}>Enter</Text>
                </Pressable>
              )}
              {letters.split('').map((l) => {
                const k = keys[l] ? STATE_STYLE[keys[l]] : null;
                return (
                  <Pressable
                    key={l}
                    onPress={() => press(l)}
                    accessibilityRole="button"
                    accessibilityLabel={l}
                    style={[styles.key, { width: keyW, height: 48 }, k && { backgroundColor: k.bg, borderColor: k.bg }]}
                  >
                    <Text style={[styles.keyText, k && { color: k.text }]}>{l.toUpperCase()}</Text>
                  </Pressable>
                );
              })}
              {i === 2 && (
                <Pressable onPress={erase} accessibilityRole="button" accessibilityLabel="Delete letter" style={[styles.key, styles.keyWide, { height: 48 }]}>
                  <Text style={styles.keyText}>⌫</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Finished this level: the answer as a dictionary entry, then straight on to the next word */}
      {finished && (
        <View style={styles.entry}>
          <Text style={styles.entryText}>
            {status === 'solved' ? 'You guessed it! ' : 'Out of attempts. '}The {LEVEL_NAMES[level - 1].toLowerCase()} word was
          </Text>
          <Text style={styles.headword}>{answer.toLowerCase()}</Text>
          {lastLevel ? (
            <Text style={styles.entryText}>That was the last word. Waiting for the others to finish…</Text>
          ) : (
            <Text style={styles.entryText}>Next word coming up…</Text>
          )}
          {sendFailed && <Button label="Send again" variant="secondary" onPress={retrySend} />}
        </View>
      )}
    </>
  );

  return <View style={styles.scene}>{scene}</View>;
}

const styles = StyleSheet.create({
  scene: { gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progress: { color: w.paperMuted, fontFamily: FONT_BODY, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  bookmark: { backgroundColor: w.oxblood, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  bookmarkSmall: { color: w.paperMuted, fontFamily: FONT_BODY, fontSize: 12 },
  bookmarkBig: { color: w.paperText, fontFamily: FONT_BODY, fontSize: 16, fontWeight: '800' },
  headerWord: { flex: 1, color: w.paperText, fontFamily: FONT_BODY, fontSize: 20, fontWeight: '800' },
  headerAttempt: { color: w.paperMuted, fontFamily: FONT_BODY, fontSize: 15, fontWeight: '600' },

  blotter: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: GAP,
    backgroundColor: w.blotter,
    borderWidth: 2,
    borderColor: w.brass,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  row: { flexDirection: 'row', gap: GAP },

  tile: { backgroundColor: w.page, borderWidth: 2, borderColor: w.pageEdge, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  tileTyped: { borderColor: w.brass },
  tileBad: { borderColor: w.badRow, backgroundColor: w.badFace },
  tileText: { color: w.ink, fontFamily: FONT_TILE, fontWeight: tileWeight },
  ribbon: { position: 'absolute', top: -5, width: 10, height: 17, backgroundColor: w.ribbon },
  ribbonNotch: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  cut: { position: 'absolute', width: 0, height: 0, borderTopColor: w.blotter, borderLeftColor: 'transparent' },
  fold: { position: 'absolute', width: 0, height: 0, borderBottomColor: w.brassDark, borderRightColor: 'transparent' },

  message: { color: '#F0C674', fontFamily: FONT_BODY, fontSize: 15, fontWeight: '700', textAlign: 'center' },

  keyboard: { gap: 6, alignItems: 'center' },
  keyRow: { flexDirection: 'row', gap: 3, justifyContent: 'center' },
  key: {
    backgroundColor: w.page,
    borderWidth: 1,
    borderColor: w.pageEdge,
    borderBottomWidth: 3,
    borderBottomColor: w.brassDark,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyWide: { paddingHorizontal: 8, minWidth: 48 },
  keyText: { color: w.ink, fontFamily: FONT_TILE, fontSize: 15, fontWeight: tileWeight },
  keyTextSmall: { color: w.ink, fontFamily: FONT_BODY, fontSize: 13, fontWeight: '800' },

  panel: {
    backgroundColor: w.blotter,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: w.brass,
    padding: 14,
    gap: 6,
    alignItems: 'center',
  },
  panelTitle: { color: w.paperText, fontFamily: FONT_BODY, fontSize: 19, fontWeight: '800' },
  panelText: { color: w.paperText, fontFamily: FONT_BODY, fontSize: 15, textAlign: 'center' },

  entry: { backgroundColor: w.page, borderRadius: 12, borderWidth: 2, borderColor: w.brass, padding: 16, gap: 6, alignItems: 'center' },
  entryText: { color: w.ink, fontFamily: FONT_BODY, fontSize: 15, textAlign: 'center' },
  headword: { color: w.oxblood, fontFamily: FONT_BODY, fontSize: 38, fontWeight: '800', fontStyle: 'italic' },
  entryRule: { height: 2, width: '60%', backgroundColor: w.pageEdge, marginBottom: 4 },
});