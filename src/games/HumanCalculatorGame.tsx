import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from '../components/ui';
import {
  ANSWER_MS,
  buildQuestion,
  GAP_MS,
  labelOf,
  READY_MS,
  REVEAL_MS,
  scoreFor,
  standings,
  START_CHANCES,
} from '../game/humanCalculator';
import type { QuestionDoc, Standings } from '../game/humanCalculator';
import { colors, radius } from '../theme';
import type { GameProps } from './types';

// Human Calculator. A question is a run of terms ("+5", "-2", "x2", "/5") shown one at a time and
// hidden again. The player adds them up from left to right and types the result within 5 seconds.
//
// Every question, in a lobby (see `room`):
//   show terms -> type the answer (5 s, auto-sent at time-up) -> wait for the others ->
//   everybody's answers + the correct answer (reveal) -> 3-2-1 -> next question.
// A wrong or missing answer costs a chance; at 0 chances the player is out and watches. The last
// player standing wins. The result (chances left, question reached) is reported ONCE with onFinish.
// All the rules live in src/game/humanCalculator.ts; every phone replays the same standings from the
// answers saved in the lobby, so nothing but the answers has to be sent.

type Phase = 'show' | 'answer' | 'sent' | 'reveal' | 'ready' | 'spectate';

const MAX_DIGITS = 5;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '<'];

const Hearts = ({ n }: { n: number }) => (
  <Text style={styles.hearts}>
    {Array.from({ length: START_CHANCES }, (_, i) => (i < n ? '♥' : '♡')).join(' ')}
  </Text>
);

export function HumanCalculatorGame({ seed, uid, onFinish, room }: GameProps) {
  const { width } = useWindowDimensions();
  const [q, setQ] = useState(1);
  const [phase, setPhase] = useState<Phase>('show');
  const [shown, setShown] = useState(-1); // index of the term on the screen, -1 = blank
  const [typed, setTyped] = useState('');
  const [left, setLeft] = useState(ANSWER_MS);
  const [count, setCount] = useState(3);
  const [sendFailed, setSendFailed] = useState(false);
  const [local, setLocal] = useState<QuestionDoc[]>([]); // solo practice run: no lobby, my own answers

  const typedRef = useRef('');
  const sentFor = useRef(0); // the last question I sent an answer for
  const lastDoc = useRef<{ stage: number; solved: boolean; ms: number; answer?: number } | null>(null);
  const answerStart = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const reported = useRef(false);

  const players = room ? room.playerIds : [uid];
  const out = room ? room.out : [];
  const names = room ? room.usernames : {};
  const docs: QuestionDoc[] = room ? room.stages : local;
  const nameOf = (p: string) => (p === uid ? 'You' : names[p] ?? 'Player');

  const question = useMemo(() => buildQuestion(seed, q), [seed, q]);

  // standings as they were right after question n (later answers of fast phones are not counted)
  const upTo = (n: number): Standings => standings(players, out, docs.filter((d) => d.stage <= n));
  const stq = upTo(q);
  const stqRef = useRef(stq);
  stqRef.current = stq;
  const stAll = standings(players, out, docs);

  const report = (st: Standings) => {
    if (reported.current) return;
    reported.current = true;
    onFinish({ finished: true, totalMs: Date.now() - startedAt.current, score: scoreFor(st.chances[uid] ?? 0, st.lastQ[uid] ?? 0) });
  };

  // ---- 1. the terms appear one by one
  useEffect(() => {
    if (phase !== 'show') return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 400;
    question.terms.forEach((_, i) => {
      timers.push(setTimeout(() => setShown(i), t));
      t += question.showMs;
      timers.push(setTimeout(() => setShown(-1), t));
      t += GAP_MS;
    });
    timers.push(
      setTimeout(() => {
        typedRef.current = '';
        setTyped('');
        setLeft(ANSWER_MS);
        answerStart.current = Date.now();
        setPhase('answer');
      }, t)
    );
    return () => timers.forEach(clearTimeout);
  }, [phase, question]);

  // ---- send my answer (once per question). `value` null = I ran out of time.
  const send = (value: number | null) => {
    if (sentFor.current >= q) return;
    sentFor.current = q;
    const solved = value === question.answer;
    const ms = Date.now() - answerStart.current;
    const doc = { stage: q, solved, ms, ...(value !== null ? { answer: value } : {}) };
    lastDoc.current = doc;
    setPhase('sent');
    if (room) {
      room.reportStage(q, doc).catch(() => setSendFailed(true));
    } else {
      setLocal((d) => [...d, { uid, ...doc }]);
    }
  };

  const retrySend = () => {
    if (!room || !lastDoc.current) return;
    setSendFailed(false);
    room.reportStage(lastDoc.current.stage, lastDoc.current).catch(() => setSendFailed(true));
  };

  // ---- 2. five seconds to answer; time-up sends what was typed (or nothing)
  useEffect(() => {
    if (phase !== 'answer') return;
    const end = answerStart.current + ANSWER_MS;
    const tick = setInterval(() => setLeft(Math.max(0, end - Date.now())), 100);
    const stop = setTimeout(() => {
      const text = typedRef.current;
      send(text.length > 0 ? Number(text) : null);
    }, ANSWER_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, q]);

  const press = (key: string) => {
    if (phase !== 'answer') return;
    let next = typedRef.current;
    if (key === 'C') next = '';
    else if (key === '<') next = next.slice(0, -1);
    else if (next.length < MAX_DIGITS) next += key;
    typedRef.current = next;
    setTyped(next);
  };

  // ---- 3. everybody answered -> reveal. Or everybody else left the game: I am the last one standing.
  useEffect(() => {
    if (phase === 'sent' && stq.completed >= q) setPhase('reveal');
    if ((phase === 'show' || phase === 'answer' || phase === 'sent') && stq.gameOver && stq.completed < q) {
      report(stqRef.current);
      setPhase('spectate');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stq.completed, stq.gameOver, q]);

  // ---- 4. reveal for a few seconds, then the next question (or the end for me)
  useEffect(() => {
    if (phase !== 'reveal') return;
    const timer = setTimeout(() => {
      const st = stqRef.current;
      if (st.gameOver || (st.chances[uid] ?? 0) === 0) {
        report(st);
        setPhase('spectate');
      } else {
        setCount(3);
        setPhase('ready');
      }
    }, REVEAL_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, q]);

  // ---- 5. "get ready" 3-2-1, then the next question
  useEffect(() => {
    if (phase !== 'ready') return;
    const step = READY_MS / 3;
    const timers = [
      setTimeout(() => setCount(2), step),
      setTimeout(() => setCount(1), step * 2),
      setTimeout(() => {
        setShown(-1);
        setQ((n) => n + 1);
        setPhase('show');
      }, READY_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  // ------------------------------------------------------------------ screens
  const keySize = Math.min(86, (width - 32 - 24) / 3);
  const chancesLeft = stAll.chances[uid] ?? START_CHANCES;

  const Reveal = ({ rq, st }: { rq: number; st: Standings }) => {
    const rqQuestion = buildQuestion(seed, rq);
    const rows = players.filter((p) => docs.some((d) => d.uid === p && d.stage === rq));
    return (
      <View style={styles.revealCard}>
        <Text style={styles.small}>Question {rq}</Text>
        <Text style={styles.bigAnswer}>{rqQuestion.answer}</Text>
        <Text style={styles.small}>{rqQuestion.terms.map(labelOf).join('  ')}</Text>
        <View style={{ height: 12 }} />
        {rows.map((p) => {
          const d = docs.find((x) => x.uid === p && x.stage === rq)!;
          return (
            <View key={p} style={styles.row}>
              <Text style={[styles.rowName, p === uid && { color: colors.accent }]} numberOfLines={1}>
                {nameOf(p)}
              </Text>
              <Text style={styles.rowAnswer}>{typeof d.answer === 'number' ? d.answer : "time's up"}</Text>
              <Text style={[styles.mark, { color: d.solved ? '#3A9D5D' : colors.danger }]}>{d.solved ? '✓' : '✗'}</Text>
              <Hearts n={st.chances[p] ?? 0} />
            </View>
          );
        })}
      </View>
    );
  };

  const header = (
    <View style={styles.top}>
      <Text style={styles.small}>Question {q}</Text>
      <Hearts n={chancesLeft} />
    </View>
  );

  if (phase === 'spectate') {
    const last = stAll.completed;
    const meAlive = (stAll.chances[uid] ?? 0) > 0;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>
          {meAlive && stAll.gameOver ? 'You are the last player standing!' : meAlive ? 'Waiting for the others...' : "You're out."}
        </Text>
        <Text style={styles.small}>
          {stAll.gameOver ? 'The game is over. Waiting for the final result...' : 'The others are still playing. You can watch.'}
        </Text>
        {last >= 1 && <Reveal rq={last} st={stAll} />}
        {sendFailed && <Button label="Send again" variant="secondary" onPress={retrySend} />}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {header}

      {phase === 'show' && (
        <View style={styles.stage}>
          <Text style={styles.term}>{shown >= 0 ? labelOf(question.terms[shown]) : ' '}</Text>
          <Text style={styles.small}>Watch the numbers...</Text>
        </View>
      )}

      {phase === 'answer' && (
        <View style={styles.stage}>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(left / ANSWER_MS) * 100}%` }]} />
          </View>
          <Text style={styles.small}>{Math.ceil(left / 1000)}s left</Text>
          <Text style={styles.typed}>{typed.length > 0 ? typed : '?'}</Text>
          <View style={[styles.pad, { width: keySize * 3 + 16 }]}>
            {KEYS.map((k) => (
              <Pressable
                key={k}
                onPress={() => press(k)}
                style={({ pressed }) => [styles.key, { width: keySize, height: keySize * 0.7 }, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.keyText}>{k === '<' ? '⌫' : k}</Text>
              </Pressable>
            ))}
          </View>
          <Button label="Send" onPress={() => send(typed.length > 0 ? Number(typed) : null)} disabled={typed.length === 0} />
        </View>
      )}

      {phase === 'sent' && (
        <View style={styles.stage}>
          <Text style={styles.title}>Answer sent</Text>
          <Text style={styles.small}>
            Waiting for the others ({players.filter((p) => stq.chances[p] > 0 && docs.some((d) => d.uid === p && d.stage === q)).length}/
            {players.filter((p) => stq.chances[p] > 0).length})
          </Text>
          {sendFailed && <Button label="Send again" variant="secondary" onPress={retrySend} />}
        </View>
      )}

      {phase === 'reveal' && <Reveal rq={q} st={stq} />}

      {phase === 'ready' && (
        <View style={styles.stage}>
          <Text style={styles.small}>Get ready for question {q + 1}</Text>
          <Text style={styles.term}>{count}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  small: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  hearts: { color: colors.danger, fontSize: 18, letterSpacing: 2 },
  term: { color: colors.text, fontSize: 96, fontWeight: '800', minHeight: 110, textAlign: 'center' },
  typed: { color: colors.accent, fontSize: 48, fontWeight: '800', minHeight: 58 },
  barTrack: { width: '100%', height: 10, borderRadius: 5, backgroundColor: colors.card, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.accent },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  key: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  keyText: { color: colors.text, fontSize: 26, fontWeight: '700' },
  revealCard: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 16, alignItems: 'center', gap: 4 },
  bigAnswer: { color: colors.accent, fontSize: 64, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', paddingVertical: 4 },
  rowName: { color: colors.text, fontSize: 15, flex: 1 },
  rowAnswer: { color: colors.text, fontSize: 15, minWidth: 64, textAlign: 'right' },
  mark: { fontSize: 18, fontWeight: '800', width: 20, textAlign: 'center' },
});
