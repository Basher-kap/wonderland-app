import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  display,
  guess,
  isHanged,
  isLetter,
  isSolved,
  LETTERS,
  MAX_CLUES_PER_PLAYER,
  MAX_WRONG,
  maxCluesTotal,
  newState,
  pickClueLetter,
  pickEntry,
  withClues,
  wrongCount,
} from '../game/hangman';
import { colors, radius } from '../theme';
import type { GameProps } from './types';

// Hangman: guess the hidden proper noun one letter at a time. Everybody gets the same word
// (from `seed`) and plays on their own; the first player to reveal it wins and the round ends for
// everybody (GameScreen, registry: endsOnFirstFinish). A clue button reveals a letter to ALL
// players: it is saved in the lobby as a `stages` doc (stage = the asker's clue number, ms = when,
// answer = index of the letter in A-Z), and every phone shows a pop-up and the letter. All the rules live
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

type Clue = { key: string; uid: string; letter: string; at: number };

export function HangmanGame({ seed, uid, onFinish, room }: GameProps) {
  const entry = useMemo(() => pickEntry(seed), [seed]);
  const [state, setState] = useState(() => newState(entry.text));
  const [localClues, setLocalClues] = useState<Clue[]>([]); // practice run (no lobby)
  const [popups, setPopups] = useState<Clue[]>([]); // clue messages waiting to be shown
  const [elapsed, setElapsed] = useState(0);
  const [asking, setAsking] = useState(false);
  const startedAt = useRef(Date.now());
  const done = useRef(false);
  const seen = useRef<Set<string> | null>(null);

  // Every clue given in this round, oldest first. In a lobby they come from the shared docs.
  const clues: Clue[] = useMemo(() => {
    if (!room) return localClues;
    return room.stages
      .filter((s) => !s.solved && typeof s.answer === 'number' && s.answer >= 0 && s.answer < 26)
      .map((s) => ({ key: `${s.uid}_${s.stage}`, uid: s.uid, letter: LETTERS[s.answer as number], at: s.ms }))
      .sort((a, b) => a.at - b.at || (a.key < b.key ? -1 : 1));
  }, [room, localClues]);

  // What I see: my own picks plus every clue letter.
  const view = useMemo(() => withClues(state, clues.map((c) => c.letter)), [state, clues]);
  const solved = isSolved(view);
  const hanged = isHanged(view);
  const wrong = wrongCount(view);

  useEffect(() => {
    startedAt.current = Date.now();
    const id = setInterval(() => {
      if (!done.current) setElapsed(Date.now() - startedAt.current);
    }, 100);
    return () => clearInterval(id);
  }, []);

  const finish = (won: boolean) => {
    if (done.current) return;
    done.current = true;
    const total = Date.now() - startedAt.current;
    setElapsed(total);
    onFinish({ finished: won, totalMs: total });
  };

  // A clue can also be the last letter I needed.
  useEffect(() => {
    if (solved) finish(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  // Pop-up for every NEW clue (the first look at the list only records what is already there).
  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(clues.map((c) => c.key));
      return;
    }
    const fresh = clues.filter((c) => !seen.current!.has(c.key));
    if (fresh.length === 0) return;
    fresh.forEach((c) => seen.current!.add(c.key));
    setPopups((p) => [...p, ...fresh]);
  }, [clues]);

  const popup = popups[0];
  useEffect(() => {
    if (!popup) return;
    const id = setTimeout(() => setPopups((p) => p.slice(1)), 2600);
    return () => clearTimeout(id);
  }, [popup]);

  const nameOf = (id: string) => (id === uid ? 'You' : room?.usernames[id] ?? 'A player');

  const myClues = clues.filter((c) => c.uid === uid).length;
  const leftForMe = Math.min(MAX_CLUES_PER_PLAYER - myClues, maxCluesTotal(entry.text) - clues.length);
  const canClue = !done.current && !solved && !hanged && !asking && leftForMe > 0 && pickClueLetter(view, seed, clues.length) !== null;

  const onClue = async () => {
    if (!canClue) return;
    const letter = pickClueLetter(view, seed, clues.length);
    if (!letter) return;
    setAsking(true);
    try {
      if (room) {
        await room.reportStage(myClues + 1, { solved: false, ms: Date.now(), answer: LETTERS.indexOf(letter) });
      } else {
        setLocalClues((c) => [...c, { key: `${uid}_${c.length + 1}`, uid, letter, at: Date.now() }]);
      }
    } catch (e) {
      console.warn('clue failed', e);
    } finally {
      setAsking(false);
    }
  };

  const onPick = (letter: string) => {
    if (done.current) return;
    const next = guess(view, letter);
    if (next === view) return;
    setState(next);
    if (isSolved(next)) finish(true);
    else if (isHanged(next)) finish(false);
  };

  const shown = display(view);
  // Break the word into words so long names wrap between words, never in the middle of one.
  const words: (string | null)[][] = [[]];
  shown.forEach((ch) => (ch === ' ' ? words.push([]) : words[words.length - 1].push(ch)));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{entry.category}</Text>
        <Text style={[styles.headerText, styles.clock]}>{clock(elapsed)}</Text>
        <Pressable
          onPress={onClue}
          disabled={!canClue}
          accessibilityRole="button"
          accessibilityLabel="Ask for a clue"
          style={[styles.clueButton, !canClue && { opacity: 0.4 }]}
        >
          <Text style={styles.clueButtonText}>Clue ({Math.max(0, leftForMe)})</Text>
        </Pressable>
      </View>

      <Drawing parts={wrong} />

      <View style={styles.wordArea}>
        {words.map((w, wi) => (
          <View key={wi} style={styles.wordRow}>
            {w.map((ch, i) =>
              // Digits and punctuation (K2, Grey's Anatomy) are shown for free, with no blank.
              ch !== null && !isLetter(ch) ? (
                <View key={i} style={styles.symbol}>
                  <Text style={styles.slotLetter}>{ch}</Text>
                </View>
              ) : (
                <View key={i} style={styles.slot}>
                  <Text style={styles.slotLetter}>{ch ?? ' '}</Text>
                </View>
              )
            )}
          </View>
        ))}
      </View>

      {solved && <Text style={[styles.banner, { color: colors.experience }]}>You revealed the word!</Text>}
      {hanged && <Text style={[styles.banner, { color: colors.danger }]}>You were hanged!</Text>}

      {!solved && !hanged && (
        <View style={styles.keyboard}>
          {ROWS.map((row) => (
            <View key={row} style={styles.keyRow}>
              {row.split('').map((l) => {
                const used = view.guessed.includes(l);
                const bad = used && !view.word.includes(l);
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

      {/* Someone asked for a clue: everybody sees who, and the letter. */}
      <Modal visible={!!popup} transparent animationType="fade" onRequestClose={() => setPopups((p) => p.slice(1))}>
        <View style={styles.popupBackdrop}>
          {popup && (
            <View style={styles.popupBox}>
              <Text style={styles.popupTitle}>{nameOf(popup.uid)} asked for a clue</Text>
              <Text style={styles.popupLetter}>{popup.letter}</Text>
              <Text style={styles.popupText}>This letter is in the word.</Text>
            </View>
          )}
        </View>
      </Modal>
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
  symbol: { width: 14, height: 34, alignItems: 'center', justifyContent: 'flex-end' },
  clueButton: {
    borderWidth: 1,
    borderColor: colors.experience,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clueButtonText: { color: colors.experience, fontSize: 15, fontWeight: '700' },
  popupBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  popupBox: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.experience,
    borderRadius: radius.md,
    paddingVertical: 22,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 8,
  },
  popupTitle: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  popupLetter: { color: colors.experience, fontSize: 64, fontWeight: '800' },
  popupText: { color: colors.muted, fontSize: 15 },
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
