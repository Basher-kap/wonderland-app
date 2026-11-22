import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { Bullets, GallowsScene, GRID_H, GRID_W, Skyline, displayWeight, FONT_DISPLAY, west } from '../gameThemes/hangman';
import type { GameProps } from './types';

// Hangman: guess the hidden proper noun one letter at a time. Everybody gets the same word
// (from `seed`) and plays on their own; the first player to reveal it wins and the round ends for
// everybody (GameScreen, registry: endsOnFirstFinish). A clue button reveals a letter to ALL
// players: it is saved in the lobby as a `stages` doc (stage = the asker's clue number, ms = when,
// answer = index of the letter in A-Z), and every phone shows a pop-up and the letter. All the rules live
// in src/game/hangman.ts; this file is only the screen. The back/forfeit buttons are provided by
// GameScreen. The answer is NOT shown to a hanged player (others may still be playing); it is
// shown to everyone in the round summary once the round is over.
//
// THE LOOK (Wild West, see gameThemes/hangman/theme.ts): the gallows scene on top, the WANTED poster
// with the hidden name under it, the keys on the plank wall at the bottom. The game is registered as
// `fullScreen`, so GameScreen gives it the whole screen with no ScrollView. Everything here is sized
// from the space it is given (onLayout), so the keys are always inside the frame and nothing scrolls.

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const BAR_H = 44; // the clock and clue row laid over the top of the sky
const MIC_SPACE = 128; // the lobby's mic pill floats in the top-right corner (VoiceButton): keep clear
const HANG_DELAY_MS = 450; // after the 6th wrong guess, the trapdoor opens
const HANG_RESULT_MS = 1800; // ...and only then the result is sent, so everybody can watch it fall
const pad = (n: number) => String(n).padStart(2, '0');
const clock = (ms: number) => `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}.${Math.floor((ms % 1000) / 100)}`;

type Clue = { key: string; uid: string; letter: string; at: number };
type Result = { finished: boolean; totalMs: number };

export function HangmanGame({ seed, uid, onFinish, room }: GameProps) {
  const entry = useMemo(() => pickEntry(seed), [seed]);
  const [state, setState] = useState(() => newState(entry.text));
  const [localClues, setLocalClues] = useState<Clue[]>([]); // practice run (no lobby)
  const [popups, setPopups] = useState<Clue[]>([]); // clue messages waiting to be shown
  const [elapsed, setElapsed] = useState(0);
  const [asking, setAsking] = useState(false);
  const [trapOpen, setTrapOpen] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 }); // the whole game area
  const [scene, setScene] = useState({ w: 0, h: 0 }); // the sky part of it
  const startedAt = useRef(Date.now());
  const done = useRef(false);
  const seen = useRef<Set<string> | null>(null);
  const pending = useRef<Result | null>(null); // a result waiting for the trapdoor to finish
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

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

  // If the round ends for everybody while the trapdoor is still falling, the result I was holding
  // back is sent now, so it is never lost.
  useEffect(
    () => () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      const r = pending.current;
      pending.current = null;
      if (r) onFinishRef.current(r);
    },
    []
  );

  // `delay` > 0: the clock stops now, but the result is sent after the delay (the hanging).
  const finish = (won: boolean, delay = 0) => {
    if (done.current) return;
    done.current = true;
    const total = Date.now() - startedAt.current;
    setElapsed(total);
    const result = { finished: won, totalMs: total };
    if (delay <= 0) {
      onFinish(result);
      return;
    }
    pending.current = result;
    pendingTimer.current = setTimeout(() => {
      const r = pending.current;
      pending.current = null;
      if (r) onFinishRef.current(r);
    }, delay);
  };

  // A clue can also be the last letter I needed.
  useEffect(() => {
    if (solved) finish(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  // The 6th wrong guess completes the outlaw; a moment later the trapdoor opens.
  useEffect(() => {
    if (!hanged) return;
    const id = setTimeout(() => setTrapOpen(true), HANG_DELAY_MS);
    return () => clearTimeout(id);
  }, [hanged]);

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
    else if (isHanged(next)) finish(false, HANG_RESULT_MS);
  };

  const shown = display(view);
  // Break the word into words so long names wrap between words, never in the middle of one.
  const words: (string | null)[][] = [[]];
  shown.forEach((ch) => (ch === ' ' ? words.push([]) : words[words.length - 1].push(ch)));
  const longest = Math.max(1, ...words.map((w) => w.length));

  // ---- sizes: everything is worked out from the space the screen gives us ----------------------
  const onBox = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (b.w === width && b.h === height ? b : { w: width, h: height }));
  };
  const onScene = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setScene((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
  };
  const colW = Math.min(box.w - 24, 520); // the poster and the keys share one column
  const keyGap = 4;
  const keyW = Math.max(24, Math.min(44, Math.floor((colW - keyGap * 9) / 10)));
  const keyH = Math.max(38, Math.min(48, Math.round(box.h * 0.065)));
  const keysH = keyH * 3 + 6 * 2;
  // The longest word of the name always fits on one line of the poster.
  const posterInner = colW - 28;
  const slotW = Math.max(14, Math.min(28, Math.floor((posterInner - (longest - 1) * 3) / longest)));
  const slotH = Math.round(slotW * 1.45);
  const u = scene.w > 0 ? Math.max(0.5, Math.min(scene.w / GRID_W, (scene.h - BAR_H) / GRID_H)) : 0;
  const boxLeft = (scene.w - GRID_W * u) / 2;
  const locked = solved || hanged;
  const spoken = shown.map((c) => (c === null ? 'blank' : c)).join(' ');

  return (
    <View style={styles.root} onLayout={onBox}>
      <View style={styles.scene} onLayout={onScene}>
        {u > 0 && <Skyline sceneW={scene.w} u={u} boxLeft={boxLeft} />}
        {u > 0 && (
          <View pointerEvents="none" style={{ position: 'absolute', left: boxLeft, bottom: 0, width: GRID_W * u, height: GRID_H * u }}>
            <GallowsScene u={u} parts={wrong} open={trapOpen} />
          </View>
        )}

        <View style={styles.topBar}>
          <View style={styles.plate} accessible accessibilityLabel="Time">
            <Text style={styles.clock}>{clock(elapsed)}</Text>
          </View>
          <Pressable
            onPress={onClue}
            disabled={!canClue}
            accessibilityRole="button"
            accessibilityLabel="Ask for a clue"
            style={[styles.plate, styles.clueButton, !canClue && { opacity: 0.45 }]}
          >
            <MaterialCommunityIcons name="star" size={18} color={west.brass} />
            <Text style={styles.clueText}>Clue ({Math.max(0, leftForMe)})</Text>
          </Pressable>
        </View>
        <View style={styles.bullets}>
          <Bullets left={Math.max(0, MAX_WRONG - wrong)} total={MAX_WRONG} />
        </View>
      </View>

      <View style={styles.wall}>
        {/* the WANTED poster: the hidden name is the outlaw's name */}
        <View style={[styles.poster, { width: colW }]} accessible accessibilityLabel={`Wanted, ${entry.category}. ${spoken}`}>
          <View style={styles.nailRow} pointerEvents="none">
            <View style={styles.nail} />
            <View style={styles.nail} />
          </View>
          <View style={styles.posterHead}>
            <Text style={styles.wanted}>WANTED</Text>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{entry.category}</Text>
            </View>
          </View>
          <View style={styles.wordArea}>
            {words.map((w, wi) => (
              <View key={wi} style={styles.wordRow}>
                {w.map((ch, i) =>
                  // Digits and punctuation (K2, Grey's Anatomy) are shown for free, with no blank.
                  ch !== null && !isLetter(ch) ? (
                    <View key={i} style={{ width: Math.round(slotW * 0.6), height: slotH, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <Text style={[styles.slotLetter, { fontSize: Math.round(slotW * 0.95) }]}>{ch}</Text>
                    </View>
                  ) : (
                    <View key={i} style={[styles.slot, { width: slotW, height: slotH }]}>
                      <Text style={[styles.slotLetter, { fontSize: Math.round(slotW * 0.95) }]}>{ch ?? ' '}</Text>
                    </View>
                  )
                )}
              </View>
            ))}
          </View>
        </View>

        {/* the keys, on the plank wall; when the game is over they give way to one line of text */}
        <View style={{ height: keysH, width: colW, marginTop: 10, justifyContent: 'center' }}>
          {locked ? (
            <Text style={[styles.banner, { color: solved ? '#B7D77A' : west.missText }]}>
              {solved ? 'You revealed the word!' : 'You were hanged!'}
            </Text>
          ) : (
            <View style={{ gap: 6 }}>
              {ROWS.map((row) => (
                <View key={row} style={[styles.keyRow, { gap: keyGap }]}>
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
                        accessibilityState={{ disabled: used }}
                        style={({ pressed }) => [
                          styles.key,
                          { width: keyW, height: keyH },
                          used && !bad && styles.keyHit,
                          bad && styles.keyMiss,
                          pressed && { transform: [{ translateY: 2 }], borderBottomWidth: 1 },
                        ]}
                      >
                        <Text style={[styles.keyText, { fontSize: Math.round(keyW * 0.58) }, bad && styles.keyTextMiss]}>{l}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Someone asked for a clue: everybody sees who, and the letter, on a telegram. */}
      <Modal visible={!!popup} transparent animationType="fade" onRequestClose={() => setPopups((p) => p.slice(1))}>
        <View style={styles.popupBackdrop}>
          {popup && (
            <View style={styles.telegram}>
              <View style={styles.telegramHead}>
                <Text style={styles.telegramHeadText}>Telegram</Text>
              </View>
              <View style={styles.telegramBody}>
                <Text style={styles.popupTitle}>{nameOf(popup.uid)} asked for a clue</Text>
                <Text style={styles.popupLetter}>{popup.letter}</Text>
                <Text style={styles.popupText}>This letter is in the word.</Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: west.wall },
  scene: { flex: 1, minHeight: 140, overflow: 'hidden' },
  topBar: {
    position: 'absolute',
    top: 6,
    left: 12,
    right: 0,
    height: BAR_H - 8,
    paddingRight: MIC_SPACE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plate: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: west.plate,
    borderWidth: 1.5,
    borderColor: west.brassDark,
    justifyContent: 'center',
  },
  clock: { color: west.cream, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 18, fontVariant: ['tabular-nums'] },
  clueButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderColor: west.brass },
  clueText: { color: west.brass, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 15 },
  bullets: { position: 'absolute', left: 12, top: BAR_H + 2 },

  wall: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: west.wall,
    borderTopWidth: 4,
    borderTopColor: west.wood,
  },
  poster: {
    backgroundColor: west.paper,
    borderWidth: 2,
    borderColor: west.paperEdge,
    borderRadius: 3,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 6,
  },
  nailRow: { position: 'absolute', top: 4, left: 5, right: 5, flexDirection: 'row', justifyContent: 'space-between' },
  nail: { width: 5, height: 5, borderRadius: 3, backgroundColor: west.brassDark },
  posterHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wanted: { color: west.wanted, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 24, letterSpacing: 2 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: west.wanted,
    borderRadius: 3,
    transform: [{ rotate: '-3deg' }],
  },
  tagText: { color: west.wanted, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 14 },
  wordArea: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 14, rowGap: 6 },
  wordRow: { flexDirection: 'row', gap: 3 },
  slot: { borderBottomWidth: 3, borderBottomColor: west.paperInk, alignItems: 'center', justifyContent: 'flex-end' },
  slotLetter: { color: west.paperInk, fontFamily: FONT_DISPLAY, fontWeight: displayWeight },

  banner: { textAlign: 'center', fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 24 },
  keyRow: { flexDirection: 'row', justifyContent: 'center' },
  key: {
    backgroundColor: west.key,
    borderWidth: 1,
    borderTopColor: west.keyTop,
    borderLeftColor: west.keyTop,
    borderRightColor: west.keyBase,
    borderBottomColor: west.keyBase,
    borderBottomWidth: 3,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyHit: { backgroundColor: west.hit, borderTopColor: west.hit, borderLeftColor: west.hit, borderRightColor: west.hitBase, borderBottomColor: west.hitBase },
  keyMiss: { backgroundColor: west.miss, borderColor: west.miss },
  keyText: { color: west.cream, fontFamily: FONT_DISPLAY, fontWeight: displayWeight },
  keyTextMiss: { color: west.missText, textDecorationLine: 'line-through', opacity: 0.8 },

  popupBackdrop: { flex: 1, backgroundColor: 'rgba(20,8,12,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  telegram: { width: 260, backgroundColor: west.paper, borderWidth: 2, borderColor: west.paperEdge, borderRadius: 3, overflow: 'hidden' },
  telegramHead: { backgroundColor: west.paperInk, paddingVertical: 6, alignItems: 'center' },
  telegramHeadText: { color: west.paper, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 15, letterSpacing: 2 },
  telegramBody: { alignItems: 'center', gap: 6, paddingVertical: 18, paddingHorizontal: 20 },
  popupTitle: { color: west.paperInk, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 18, textAlign: 'center' },
  popupLetter: { color: west.wanted, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 64 },
  popupText: { color: west.paperInk, fontFamily: FONT_DISPLAY, fontSize: 15 },
});
