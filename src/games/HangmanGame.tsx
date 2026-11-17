import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  display,
  guess,
  isHanged,
  isSolved,
  MAX_WRONG,
  newState,
  pickEntry,
  wrongCount,
} from '../game/hangman';
import { colors, radius } from '../theme';
import type { GameProps } from './types';

// Hangman: guess the hidden proper noun one letter at a time. Everybody gets the same word
// (from `seed`) and plays on their own; the fastest player to reveal it wins. All the rules live
// in src/game/hangman.ts; this file is only the screen. The back/forfeit buttons are provided by
// GameScreen. The answer is NOT shown to a hanged player (others may still be playing); it is
// shown to everyone in the round summary once the round is over.

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const pad = (n: number) => String(n).padStart(2, '0');
const clock = (ms: number) => `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}.${Math.floor((ms % 1000) / 100)}`;

// The gallows and the person, drawn with plain views. `parts` = how many parts are drawn (0-6).
function Drawing({ parts }: { parts: number }) {
  const ink = parts >= MAX_WRONG ? colors.danger : colors.text;
  return (
    <View style={styles.drawing}>
      <View style={[styles.line, { left: 20, bottom: 0, width: 110, height: 4 }]} />
      <View style={[styles.line, { left: 50, bottom: 0, width: 4, height: 170 }]} />
      <View style={[styles.line, { left: 50, top: 6, width: 90, height: 4 }]} />
      <View style={[styles.line, { left: 136, top: 6, width: 3, height: 22 }]} />
      {parts >= 1 && <View style={[styles.head, { borderColor: ink }]} />}
      {parts >= 2 && <View style={[styles.limb, { backgroundColor: ink, left: 136, top: 58, width: 3, height: 50 }]} />}
      {parts >= 3 && (
        <View style={[styles.limb, { backgroundColor: ink, left: 118, top: 68, width: 3, height: 34, transform: [{ rotate: '35deg' }] }]} />
      )}
      {parts >= 4 && (
        <View style={[styles.limb, { backgroundColor: ink, left: 154, top: 68, width: 3, height: 34, transform: [{ rotate: '-35deg' }] }]} />
      )}
      {parts >= 5 && (
        <View style={[styles.limb, { backgroundColor: ink, left: 122, top: 110, width: 3, height: 40, transform: [{ rotate: '25deg' }] }]} />
      )}
      {parts >= 6 && (
        <View style={[styles.limb, { backgroundColor: ink, left: 150, top: 110, width: 3, height: 40, transform: [{ rotate: '-25deg' }] }]} />
      )}
    </View>
  );
}

export function HangmanGame({ seed, onFinish }: GameProps) {
  const entry = useMemo(() => pickEntry(seed), [seed]);
  const [state, setState] = useState(() => newState(entry.text));
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());
  const done = useRef(false);

  const solved = isSolved(state);
  const hanged = isHanged(state);
  const wrong = wrongCount(state);

  useEffect(() => {
    startedAt.current = Date.now();
    const id = setInterval(() => {
      if (!done.current) setElapsed(Date.now() - startedAt.current);
    }, 100);
    return () => clearInterval(id);
  }, []);

  const onPick = (letter: string) => {
    if (done.current) return;
    const next = guess(state, letter);
    if (next === state) return;
    setState(next);
    if (isSolved(next) || isHanged(next)) {
      done.current = true;
      const total = Date.now() - startedAt.current;
      setElapsed(total);
      onFinish({ finished: isSolved(next), totalMs: total });
    }
  };

  const shown = display(state);
  // Break the word into words so long names wrap between words, never in the middle of one.
  const words: (string | null)[][] = [[]];
  shown.forEach((ch) => (ch === ' ' ? words.push([]) : words[words.length - 1].push(ch)));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{entry.category}</Text>
        <Text style={[styles.headerText, styles.clock]}>{clock(elapsed)}</Text>
        <Text style={styles.headerText}>
          Wrong {wrong}/{MAX_WRONG}
        </Text>
      </View>

      <Drawing parts={wrong} />

      <View style={styles.wordArea}>
        {words.map((w, wi) => (
          <View key={wi} style={styles.wordRow}>
            {w.map((ch, i) => (
              <View key={i} style={styles.slot}>
                <Text style={styles.slotLetter}>{ch ?? ' '}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      {solved && <Text style={[styles.banner, { color: colors.experience }]}>Solved in {clock(elapsed)}!</Text>}
      {hanged && <Text style={[styles.banner, { color: colors.danger }]}>You were hanged!</Text>}

      {!solved && !hanged && (
        <View style={styles.keyboard}>
          {ROWS.map((row) => (
            <View key={row} style={styles.keyRow}>
              {row.split('').map((l) => {
                const used = state.guessed.includes(l);
                const bad = used && !state.word.includes(l);
                return (
                  <Pressable
                    key={l}
                    onPress={() => onPick(l)}
                    disabled={used}
                    accessibilityRole="button"
                    accessibilityLabel={`Letter ${l}`}
                    style={({ pressed }) => [
                      styles.key,
                      used && !bad && styles.keyHit,
                      bad && styles.keyMiss,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.keyText, used && { opacity: 0.6 }]}>{l}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
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
  drawing: { width: 180, height: 190, alignSelf: 'center' },
  line: { position: 'absolute', backgroundColor: colors.muted, borderRadius: 2 },
  head: { position: 'absolute', left: 124, top: 28, width: 28, height: 28, borderRadius: 14, borderWidth: 3 },
  limb: { position: 'absolute', borderRadius: 2 },
  wordArea: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 18, rowGap: 10 },
  wordRow: { flexDirection: 'row', gap: 4 },
  slot: { width: 22, height: 34, borderBottomWidth: 3, borderBottomColor: colors.experience, alignItems: 'center', justifyContent: 'flex-end' },
  slotLetter: { color: colors.text, fontSize: 22, fontWeight: '800' },
  banner: { textAlign: 'center', fontSize: 24, fontWeight: '800', paddingVertical: 8 },
  keyboard: { gap: 8, marginTop: 4 },
  keyRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  key: {
    width: 31,
    height: 44,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.experience,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyHit: { backgroundColor: '#1F6F55', borderColor: colors.experience },
  keyMiss: { backgroundColor: '#5A2424', borderColor: colors.danger },
  keyText: { color: colors.text, fontSize: 17, fontWeight: '700' },
});
