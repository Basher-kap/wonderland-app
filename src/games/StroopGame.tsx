import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { buildQuestions, COLOR_NAME, FEEDBACK_MS, judge, QUESTION_COUNT, summarize } from '../game/stroop';
import type { Answer, ColorId } from '../game/stroop';
import { useReduceMotion } from '../components/ui/useReduceMotion';
import { Candle, Sign } from '../gameThemes/stroop/StroopArt';
import { displayWeight, FONT_DISPLAY, INK, party } from '../gameThemes/stroop/theme';
import type { GameProps } from './types';

// Stroop Effect: a color word appears, written in a color that may or may not match what it says. Tap the color
// of the LETTERS, not the word, before the candle burns out. Every player gets the same 20 questions (from `seed`)
// and answers at their own pace; 1 point for a right answer, 0 for a wrong or missing one. The highest score
// wins when everybody has finished. All the rules are in src/game/stroop.ts; this file is only the screen.
//
// Hidden notes kept here on purpose, not in the rules window: the time limit shrinks from 5 s to 2.5 s, the word
// matches its own color less and less often, from question 11 purple and orange join the four colors and the
// buttons change places every question.
//
// THE LOOK (a kid's birthday party, see gameThemes/stroop/theme.ts): the room is the screen background
// (PartyBackground); this file draws the sign, the candle timer and the color buttons. The game is registered as
// `fullScreen`, so GameScreen gives it the whole screen with no ScrollView.

const MIC_SPACE = 128; // the lobby's mic pill floats in the top-right corner (VoiceButton): keep clear
const READY_MS = 2000; // "get ready" before the first word
const GARLAND_H = 64; // the garland and the streamers at the top of the background

type Phase = 'ready' | 'asking' | 'feedback' | 'done';

export function StroopGame({ seed, onFinish }: GameProps) {
  const questions = useMemo(() => buildQuestions(seed), [seed]);
  const reduce = useReduceMotion();
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [fb, setFb] = useState<{ picked: ColorId | null; ok: boolean } | null>(null);
  const [score, setScore] = useState(0);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [, setFrame] = useState(0); // re-render a few times per second for the candle
  const answers = useRef<Answer[]>([]);
  const askedAt = useRef(Date.now());
  const done = useRef(false);

  const q = questions[Math.min(idx, QUESTION_COUNT - 1)];

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => f + 1), 80);
    return () => clearInterval(id);
  }, []);

  // "Get ready", then the first word.
  useEffect(() => {
    if (phase !== 'ready') return;
    const id = setTimeout(() => {
      askedAt.current = Date.now();
      setPhase('asking');
    }, READY_MS);
    return () => clearTimeout(id);
  }, [phase]);

  const answer = (picked: ColorId | null) => {
    if (phase !== 'asking') return;
    const ms = Math.min(q.limitMs, Date.now() - askedAt.current);
    const ok = judge(q, picked);
    answers.current.push({ picked, ms });
    if (ok) setScore((s) => s + 1);
    setFb({ picked, ok });
    setPhase('feedback');
  };

  // Too slow: no answer.
  const answerRef = useRef(answer);
  answerRef.current = answer;
  useEffect(() => {
    if (phase !== 'asking') return;
    const id = setTimeout(() => answerRef.current(null), Math.max(0, q.limitMs - (Date.now() - askedAt.current)));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx]);

  // The right / wrong note stays for a moment, then the next word (or the end).
  useEffect(() => {
    if (phase !== 'feedback') return;
    const id = setTimeout(() => {
      if (idx + 1 >= QUESTION_COUNT) {
        setPhase('done');
        if (!done.current) {
          done.current = true;
          const sum = summarize(questions, answers.current);
          onFinish({ finished: true, totalMs: sum.totalMs, score: sum.score });
        }
        return;
      }
      setFb(null);
      setIdx(idx + 1);
      askedAt.current = Date.now();
      setPhase('asking');
    }, FEEDBACK_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const now = Date.now();
  const left = phase === 'asking' ? Math.max(0, 1 - (now - askedAt.current) / q.limitMs) : phase === 'ready' || phase === 'done' ? (phase === 'ready' ? 1 : 0) : fb?.picked === null ? 0 : Math.max(0, 1 - (answers.current[idx]?.ms ?? 0) / q.limitMs);
  const flicker = reduce ? 0 : Math.sin(now / 90);
  const signW = Math.max(220, Math.min(360, area.w - 40));
  const signH = 150;
  const fontSize = Math.min(64, (signW * 0.8) / (COLOR_NAME[q.word].length * 0.7));
  const cols = 2;
  const rows = Math.ceil(q.options.length / cols);
  const btnH = rows === 2 ? 64 : 54;

  const note =
    phase === 'ready'
      ? 'Get ready. Pick the color of the letters, not the word.'
      : phase === 'asking'
        ? 'What color are the letters?'
        : fb?.ok
          ? 'Correct! +1'
          : fb?.picked === null
            ? `Time's up. It was ${COLOR_NAME[q.ink]}.`
            : `Not quite. It was ${COLOR_NAME[q.ink]}.`;

  if (phase === 'done') {
    return (
      <View style={styles.center}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>All done!</Text>
          <Text style={styles.panelScore}>
            {score} of {QUESTION_COUNT}
          </Text>
          <Text style={styles.panelSub}>Waiting for the other players to finish…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} onLayout={(e: LayoutChangeEvent) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <View style={[styles.hud, { paddingRight: MIC_SPACE }]}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>
            Question {Math.min(idx + 1, QUESTION_COUNT)} of {QUESTION_COUNT}
          </Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Score {score}</Text>
        </View>
      </View>

      <View style={styles.stage}>
        <Sign width={signW} height={signH} state={phase === 'feedback' ? (fb?.ok ? 'good' : 'bad') : null}>
          {phase === 'ready' ? (
            <Text style={[styles.word, { fontSize: 40, color: party.signText }]}>READY?</Text>
          ) : (
            <Text accessibilityLabel={`The word ${COLOR_NAME[q.word]}`} style={[styles.word, { fontSize, color: INK[q.ink] }]}>
              {COLOR_NAME[q.word]}
            </Text>
          )}
        </Sign>
        <View style={{ marginTop: 10 }}>
          <Candle width={signW} left={left} flicker={flicker} />
        </View>
        <View style={[styles.note, phase === 'feedback' && { backgroundColor: fb?.ok ? party.good : party.bad }]}>
          <Text style={[styles.noteText, phase === 'feedback' && { color: '#fff' }]}>{note}</Text>
        </View>
      </View>

      <View style={styles.buttons}>
        {Array.from({ length: rows }, (_, r) => (
          <View key={r} style={styles.row}>
            {q.options.slice(r * cols, r * cols + cols).map((c) => {
              const isRight = phase === 'feedback' && c === q.ink;
              const isMiss = phase === 'feedback' && fb?.picked === c && !fb.ok;
              return (
                <Pressable
                  key={c}
                  onPress={() => answer(c)}
                  disabled={phase !== 'asking'}
                  accessibilityLabel={`${COLOR_NAME[c]} button`}
                  style={[styles.btn, { height: btnH, backgroundColor: INK[c] }, isRight && styles.btnRight, isMiss && styles.btnMiss, phase === 'ready' && { opacity: 0.55 }]}
                >
                  <Text style={styles.btnText}>{COLOR_NAME[c]}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: GARLAND_H },
  hud: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14, gap: 8 },
  pill: { backgroundColor: party.panel, borderColor: party.ink, borderWidth: 2, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: party.ink, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 13 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  word: { fontFamily: FONT_DISPLAY, fontWeight: displayWeight, letterSpacing: 2, textAlign: 'center' },
  note: { marginTop: 8, minHeight: 36, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: party.panel, borderWidth: 2, borderColor: party.ink, justifyContent: 'center' },
  noteText: { color: party.ink, fontWeight: '800', fontSize: 14, textAlign: 'center' },
  buttons: { paddingHorizontal: 16, paddingBottom: 18, gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, borderRadius: 18, borderWidth: 3, borderColor: party.ink, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  btnRight: { borderColor: '#fff', borderWidth: 5 },
  btnMiss: { opacity: 0.45 },
  btnText: { color: party.ink, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 17, letterSpacing: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  panel: { backgroundColor: party.paper, borderColor: party.ink, borderWidth: 3, borderRadius: 18, padding: 20, alignItems: 'center', maxWidth: 340 },
  panelTitle: { color: party.title, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 26 },
  panelScore: { color: party.ink, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 40, marginTop: 4 },
  panelSub: { color: party.inkSoft, marginTop: 8, fontSize: 14, textAlign: 'center' },
});
