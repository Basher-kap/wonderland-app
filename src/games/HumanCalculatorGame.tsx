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
import { calc as c, FONT_LABEL, FONT_SCREEN } from '../gameThemes/humanCalculator';
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
//
// LOOK: a quiz-show stage (gameThemes/humanCalculator/theme.ts). The curtains, the marquee, the
// floor and the rules dialogs are in gameThemes/humanCalculator/QuizStageBackground.tsx and gameThemes/humanCalculator/intro.tsx. The terms, the typed answer and
// the correct answer appear on the big monitor. Chances are lamps (lit = still in), the 5 seconds
// are a row of bulbs under the screen that go out one by one and turn red at the end.

type Phase = 'show' | 'answer' | 'sent' | 'reveal' | 'ready' | 'spectate';

const MAX_DIGITS = 5;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '<'];
const TIMER_BULBS = 12;

// ---- chances: one lamp each, lit = still in the game
const Chances = ({ n, size = 16 }: { n: number; size?: number }) => (
  <View style={styles.lamps} accessible accessibilityLabel={`${n} of ${START_CHANCES} chances left`}>
    {Array.from({ length: START_CHANCES }, (_, i) => (
      <View
        key={i}
        style={[
          { width: size, height: size, borderRadius: size },
          i < n ? [styles.lampOn, { shadowRadius: size / 2 }] : styles.lampOff,
        ]}
      />
    ))}
  </View>
);

// ---- big digits on the monitor; a new term pops in (skipped with reduce-motion)
function ScreenText({ value, size, color, reduceMotion }: { value: string; size: number; color?: string; reduceMotion: boolean }) {
  const pop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion || value.trim() === '') return;
    pop.setValue(0.88);
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 160, useNativeDriver: true }).start();
  }, [value, reduceMotion, pop]);
  return (
    <Animated.Text
      style={[styles.digits, { fontSize: size, minHeight: size * 1.15, lineHeight: size * 1.15 }, color ? { color } : null, { transform: [{ scale: pop }] }]}
    >
      {value}
    </Animated.Text>
  );
}

// ---- the monitor: bezel, screen, optional timer bulbs, and a stand
function Monitor({ children, timerLeft }: { children: React.ReactNode; timerLeft?: number | null }) {
  const lit = timerLeft == null ? 0 : Math.ceil((timerLeft / ANSWER_MS) * TIMER_BULBS);
  return (
    <View style={styles.monitorWrap}>
      <View style={styles.bezel}>
        <View style={styles.screen}>{children}</View>
        {timerLeft != null && (
          <View style={styles.timerRow} accessible accessibilityLabel={`${Math.ceil(timerLeft / 1000)} seconds left`}>
            {Array.from({ length: TIMER_BULBS }, (_, i) => (
              <View
                key={i}
                style={[styles.timerBulb, i < lit ? { backgroundColor: lit <= 3 ? c.hot : c.gold } : { backgroundColor: c.bulbOff }]}
              />
            ))}
          </View>
        )}
      </View>
      <View style={styles.neck} />
      <View style={styles.base} />
    </View>
  );
}

export function HumanCalculatorGame({ seed, uid, onFinish, room }: GameProps) {
  const { width } = useWindowDimensions();
  const [q, setQ] = useState(1);
  const [phase, setPhase] = useState<Phase>('show');
  const [shown, setShown] = useState(-1); // index of the term on the screen, -1 = blank
  const [typed, setTyped] = useState('');
  const [left, setLeft] = useState(ANSWER_MS);
  const [count, setCount] = useState(3);
  const [sendFailed, setSendFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [local, setLocal] = useState<QuestionDoc[]>([]); // solo practice run: no lobby, my own answers

  const typedRef = useRef('');
  const sentFor = useRef(0); // the last question I sent an answer for
  const lastDoc = useRef<{ stage: number; solved: boolean; ms: number; answer?: number } | null>(null);
  const answerStart = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const reported = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

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
  // Out of chances: I keep watching the numbers of every question, but I cannot answer any more.
  const iAmOut = (stq.chances[uid] ?? START_CHANCES) === 0;

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
    if (iAmOut) {
      setPhase('sent'); // nothing to send: just wait for the others, then watch the reveal
      return;
    }
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
      if ((st.chances[uid] ?? 0) === 0) report(st); // my result goes in, but I stay and watch
      if (st.gameOver) {
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
  // screen padding 20+20, podium padding 12+12, key gaps 16
  const keySize = Math.max(54, Math.min(80, Math.floor((width - 80) / 3)));
  const chancesLeft = stAll.chances[uid] ?? START_CHANCES;

  // The scoreboard: the correct answer is on the monitor, everybody's answer is here.
  const Board = ({ rq, st }: { rq: number; st: Standings }) => {
    const rqQuestion = buildQuestion(seed, rq);
    const rows = players.filter((p) => docs.some((d) => d.uid === p && d.stage === rq));
    return (
      <View style={styles.board}>
        <Text style={styles.boardHead}>{rqQuestion.terms.map(labelOf).join('  ')}</Text>
        {rows.map((p) => {
          const d = docs.find((x) => x.uid === p && x.stage === rq)!;
          return (
            <View key={p} style={styles.row}>
              <Text style={[styles.rowName, p === uid && { color: c.gold }]} numberOfLines={1}>
                {nameOf(p)}
              </Text>
              <Text style={styles.rowAnswer}>{typeof d.answer === 'number' ? d.answer : "time's up"}</Text>
              <Text style={[styles.mark, { color: d.solved ? c.ok : c.bad }]}>{d.solved ? '✓' : '✗'}</Text>
              <Chances n={st.chances[p] ?? 0} size={11} />
            </View>
          );
        })}
      </View>
    );
  };

  const revealMonitor = (rq: number) => (
    <Monitor>
      <Text style={styles.cap}>Question {rq}</Text>
      <ScreenText value={String(buildQuestion(seed, rq).answer)} size={64} reduceMotion={reduceMotion} />
    </Monitor>
  );

  const frame = (body: React.ReactNode) => <View style={styles.stage}>{body}</View>;

  if (phase === 'spectate') {
    const last = stAll.completed;
    const meAlive = (stAll.chances[uid] ?? 0) > 0;
    return frame(
      <View style={styles.wrap}>
        <Monitor>
          <Text style={styles.screenTitle}>
            {meAlive && stAll.gameOver ? 'You are the last player standing!' : meAlive ? 'Waiting for the others...' : "You're out."}
          </Text>
          <Text style={styles.cap}>
            {stAll.gameOver ? 'The game is over. Waiting for the final result...' : 'The others are still playing. You can watch.'}
          </Text>
        </Monitor>
        {last >= 1 && <Board rq={last} st={stAll} />}
        {sendFailed && <Button label="Send again" variant="secondary" onPress={retrySend} />}
      </View>
    );
  }

  return frame(
    <View style={styles.wrap}>
      <View style={styles.top}>
        <View style={styles.plate}>
          <Text style={styles.plateText}>{iAmOut ? `Question ${q} · watching` : `Question ${q}`}</Text>
        </View>
        <Chances n={chancesLeft} />
      </View>

      {phase === 'show' && (
        <Monitor>
          <ScreenText value={shown >= 0 ? labelOf(question.terms[shown]) : ' '} size={88} reduceMotion={reduceMotion} />
          <Text style={styles.cap}>{iAmOut ? 'You are out: just watch the numbers...' : 'Watch the numbers...'}</Text>
        </Monitor>
      )}

      {phase === 'answer' && iAmOut && (
        <Monitor timerLeft={left}>
          <Text style={styles.screenTitle}>You are out</Text>
          <Text style={styles.cap}>You can watch, but you cannot answer. {Math.ceil(left / 1000)}s left</Text>
        </Monitor>
      )}

      {phase === 'answer' && !iAmOut && (
        <>
          <Monitor timerLeft={left}>
            <Text style={styles.cap}>{Math.ceil(left / 1000)}s left</Text>
            <ScreenText value={typed.length > 0 ? typed : '?'} size={56} color={typed.length > 0 ? c.screenText : c.screenMuted} reduceMotion={true} />
          </Monitor>
          <View style={styles.podium}>
            <View style={[styles.pad, { width: keySize * 3 + 16 }]}>
              {KEYS.map((k) => (
                <Pressable
                  key={k}
                  onPress={() => press(k)}
                  accessibilityRole="button"
                  accessibilityLabel={k === '<' ? 'Delete digit' : k === 'C' ? 'Clear' : k}
                  style={({ pressed }) => [styles.key, { width: keySize, height: keySize * 0.7 }, pressed && { transform: [{ translateY: 3 }], borderBottomWidth: 1 }]}
                >
                  <Text style={styles.keyText}>{k === '<' ? '⌫' : k}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => send(typed.length > 0 ? Number(typed) : null)}
              disabled={typed.length === 0}
              accessibilityRole="button"
              style={({ pressed }) => [styles.sendBtn, typed.length === 0 && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.sendText}>Send</Text>
            </Pressable>
          </View>
        </>
      )}

      {phase === 'sent' && (
        <Monitor>
          <Text style={styles.screenTitle}>{iAmOut ? 'You are out' : 'Answer sent'}</Text>
          <Text style={styles.cap}>
            Waiting for the others ({players.filter((p) => stq.chances[p] > 0 && docs.some((d) => d.uid === p && d.stage === q)).length}/
            {players.filter((p) => stq.chances[p] > 0).length})
          </Text>
          {sendFailed && <Button label="Send again" variant="secondary" onPress={retrySend} />}
        </Monitor>
      )}

      {phase === 'reveal' && (
        <>
          {revealMonitor(q)}
          <Board rq={q} st={stq} />
        </>
      )}

      {phase === 'ready' && (
        <Monitor>
          <Text style={styles.cap}>Get ready for question {q + 1}</Text>
          <ScreenText value={String(count)} size={88} reduceMotion={reduceMotion} />
        </Monitor>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { minHeight: 560 },
  wrap: { gap: 14, paddingTop: 6 },

  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  plate: { backgroundColor: c.board, borderColor: c.gold, borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  plateText: { color: c.boardText, fontFamily: FONT_LABEL, fontSize: 15, fontWeight: '800' },
  lamps: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  lampOn: { backgroundColor: c.gold, borderWidth: 1, borderColor: '#FFE08A', shadowColor: c.gold, shadowOpacity: 0.9, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  lampOff: { backgroundColor: c.bulbOff, borderWidth: 1, borderColor: c.goldDim },

  // monitor
  monitorWrap: { alignItems: 'center' },
  bezel: { alignSelf: 'stretch', backgroundColor: c.bezel, borderColor: c.bezelEdge, borderWidth: 3, borderRadius: 14, padding: 8, gap: 8 },
  screen: { backgroundColor: c.screen, borderRadius: 7, minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12 },
  neck: { width: 44, height: 14, backgroundColor: c.bezelEdge },
  base: { width: 130, height: 8, borderRadius: 4, backgroundColor: c.bezel, borderWidth: 2, borderColor: c.bezelEdge },
  timerRow: { flexDirection: 'row', gap: 5, justifyContent: 'center', paddingBottom: 2 },
  timerBulb: { width: 14, height: 14, borderRadius: 14 },
  digits: {
    color: c.screenText,
    fontFamily: FONT_SCREEN,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: c.screenGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  cap: { color: c.screenMuted, fontFamily: FONT_LABEL, fontSize: 14, textAlign: 'center' },
  screenTitle: { color: c.screenText, fontFamily: FONT_LABEL, fontSize: 22, fontWeight: '800', textAlign: 'center' },

  // podium + keypad
  podium: { backgroundColor: c.podium, borderTopColor: c.gold, borderTopWidth: 4, borderRadius: 10, padding: 12, alignItems: 'center', gap: 12 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  key: { backgroundColor: c.key, borderColor: c.keyEdge, borderWidth: 1, borderBottomWidth: 4, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  keyText: { color: c.keyText, fontFamily: FONT_SCREEN, fontSize: 26, fontWeight: '800' },
  sendBtn: { backgroundColor: c.gold, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center' },
  sendText: { color: '#1B1405', fontFamily: FONT_LABEL, fontSize: 17, fontWeight: '800' },

  // scoreboard
  board: { backgroundColor: c.board, borderColor: c.gold, borderWidth: 2, borderRadius: 12, padding: 14, gap: 4 },
  boardHead: { color: c.boardMuted, fontFamily: FONT_SCREEN, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', paddingVertical: 4 },
  rowName: { color: c.boardText, fontFamily: FONT_LABEL, fontSize: 15, flex: 1 },
  rowAnswer: { color: c.boardText, fontFamily: FONT_SCREEN, fontSize: 15, minWidth: 64, textAlign: 'right' },
  mark: { fontSize: 18, fontWeight: '800', width: 20, textAlign: 'center' },
});
