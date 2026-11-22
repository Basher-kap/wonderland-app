import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ANSWER_MS,
  apply,
  cleanGuess,
  DECK_SIZE,
  deckFor,
  offeredSlips,
  formatNumber,
  GAME_LIVES,
  newGame,
  PICK_PENALTY,
  questionOf,
  remainingNow,
  Result,
  shuffleOrder,
  State,
  tick,
  TIERS,
} from '../game/fortune';
import * as api from '../lib/api';
import { ShrineIcon, FONT_FORTUNE, fortune as p, TIER_INK } from '../gameThemes/fortune';
import type { GameProps } from './types';

// Fortune: a small temple picks a player at random; that player draws one of the covered fortune
// slips (a pane slides in from the left), everybody sees the fortune and the numerical question on
// it, and the player has 45 seconds to answer. A wrong answer costs life by the margin of error
// and the luck of the slip, and part of it splashes on the others. The last player alive wins.
//
// All the rules live in src/game/fortune.ts. The HOST's phone is the only one that runs the game:
// it applies everybody's moves (saved in lobbies/{code}/fortune) and saves the state, which every
// phone shows. The other phones only show the state and send moves. If the host forfeits the game,
// the others cannot continue (known limit, same as Magical Banana). The forfeit buttons are
// GameScreen's.
//
// LOOK: a night festival with a small shrine (gameThemes/fortune/theme.ts). The lanterns, the torii and
// the rules dialogs are in gameThemes/fortune/FestivalBackground.tsx and gameThemes/fortune/intro.tsx; the shrine is
// gameThemes/fortune/ShrineIcon.tsx; a drawn slip is omikuji paper.
//
// Hidden notes kept here on purpose, not in the rules window: the temple chooses at random until
// everybody was chosen, then starts over; the pane scrolls with covered slips; the drawn slip is
// shown to everybody; the answer, the right answer and the life lost are revealed to everybody.

const secondsLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000));

export function FortuneGame({ seed, uid, onFinish, room }: GameProps) {
  const [st, setSt] = useState<State | null>(null);
  const [text, setText] = useState('');
  const [, setFrame] = useState(0); // re-render a few times per second for the countdowns
  const receivedAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const sent = useRef(''); // the move already sent for this step of the game
  const finished = useRef(false);
  const slide = useRef(new Animated.Value(-300)).current;
  const roomRef = useRef(room);
  roomRef.current = room;
  const host = useRef<{ state: State | null; pending: State | null; writing: boolean }>({
    state: null,
    pending: null,
    writing: false,
  });

  // Subscribe to the game. The host also runs it.
  useEffect(() => {
    const r = roomRef.current;
    if (!r) return;
    const round = { matchId: r.matchId, roundNo: r.roundNo };
    const h = host.current;

    const show = (s: State) => {
      receivedAt.current = Date.now();
      setSt(s);
    };

    // Save the latest state (one write at a time; only the newest state matters).
    const flush = () => {
      if (h.writing || !h.pending) return;
      const s = h.pending;
      h.pending = null;
      h.writing = true;
      const data = JSON.stringify({ ...s, remainingMs: s.endsAt ? Math.max(0, s.endsAt - Date.now()) : 0 });
      api
        .writeFortuneState(r.code, round, s.ver, data)
        .catch((e) => console.warn('saving the game failed', e))
        .finally(() => {
          h.writing = false;
          flush();
        });
    };
    const hostSet = (s: State) => {
      h.state = s;
      h.pending = s;
      show({ ...s, remainingMs: s.endsAt ? Math.max(0, s.endsAt - Date.now()) : 0 });
      flush();
    };

    const unsubscribe = api.subscribeFortune(
      r.code,
      (snap) => {
        let docState: State | null = null;
        if (snap.state && snap.state.matchId === round.matchId && snap.state.roundNo === round.roundNo) {
          try {
            docState = JSON.parse(snap.state.data) as State;
          } catch {
            docState = null;
          }
        }
        if (!r.isHost) {
          if (docState) show(docState);
          return;
        }
        // HOST: start the game (or carry on from the saved state), then apply the new moves.
        if (!h.state) {
          if (docState) {
            h.state = docState;
            show(docState);
          } else {
            hostSet(newGame(shuffleOrder(r.playerIds, seed), seed, Date.now()));
          }
        }
        let s = h.state!;
        const moves = snap.moves
          .filter((m) => m.matchId === round.matchId && m.roundNo === round.roundNo)
          .sort((a, b) => a.at - b.at);
        for (const m of moves) s = apply(s, m, Date.now());
        if (s !== h.state) hostSet(s);
      },
      (e) => console.warn('game listener failed', e)
    );

    // HOST: the timers (choosing, temple, 10 seconds to pick, 45 seconds to answer, the reveal) and
    // players who forfeited.
    const timer = r.isHost
      ? setInterval(() => {
          if (!h.state) return;
          const next = tick(h.state, Date.now(), roomRef.current?.out ?? []);
          if (next !== h.state) hostSet(next);
        }, 200)
      : null;

    return () => {
      unsubscribe();
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => f + 1), 100);
    return () => clearInterval(id);
  }, []);

  // A new step of the game: the answer box starts empty again.
  useEffect(() => setText(''), [st?.rev]);

  // The slip pane slides in from the left whenever somebody has to pick.
  useEffect(() => {
    if (st?.phase !== 'pick') return;
    slide.setValue(-300);
    Animated.timing(slide, { toValue: 0, duration: 350, useNativeDriver: true }).start();
  }, [st?.phase, st?.rev, slide]);

  // The game is over: after a moment everybody reports. Only the last player alive "finished".
  useEffect(() => {
    if (st?.phase !== 'over' || finished.current) return;
    const id = setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onFinish({ finished: st.winner === uid, totalMs: Date.now() - startedAt.current });
    }, 4000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.phase, st?.winner]);

  if (!room) {
    return (
      <View style={styles.waiting}>
        <Text style={styles.waitingTitle}>Fortune needs other players</Text>
        <Text style={styles.waitingText}>Create or join a lobby to play it.</Text>
      </View>
    );
  }
  if (!st) {
    return (
      <View style={styles.waiting}>
        <Text style={styles.waitingText}>Getting the game ready…</Text>
      </View>
    );
  }

  const name = (id: string | null) => (id ? room.usernames[id] ?? 'A player' : 'Nobody');
  const left = remainingNow(st, receivedAt.current, Date.now());
  const alive = st.alive.includes(uid);
  const mine = st.current === uid && alive;
  const deck = deckFor(seed);
  const slip = st.slip !== null ? deck[st.slip] : null;
  const question = slip ? questionOf(slip) : null;
  const tier = slip ? TIERS[slip.tier] : null;
  const result = st.result;

  // The temple "chooses": the highlight runs over the living players, then lands on the chosen one.
  const roulette = st.phase === 'choosing' && left > 800 && st.alive.length > 1;
  const highlighted = roulette
    ? st.alive[Math.floor(Date.now() / 130) % st.alive.length]
    : st.phase === 'over'
      ? null
      : st.current;

  const send = (kind: 'open' | 'pick' | 'answer', extra: { slip?: number; guess?: number } = {}) => {
    const key = `${kind}:${st.rev}`;
    if (sent.current === key) return;
    sent.current = key;
    api
      .sendFortuneMove(room.code, { matchId: room.matchId, roundNo: room.roundNo }, { rev: st.rev, kind, ...extra })
      .catch((e) => {
        sent.current = '';
        console.warn('move failed', e);
      });
  };
  const submitAnswer = () => {
    const guess = cleanGuess(text);
    if (guess === null) return;
    send('answer', { guess });
  };

  // "You lose" / "Mika loses".
  const who = (id: string) => (id === uid ? 'You' : name(id));
  const verb = (id: string, you: string, other: string) => (id === uid ? you : other);

  const resultLines = (r: Result): string[] => {
    const lines: string[] = [];
    const w = who(r.uid);
    switch (r.kind) {
      case 'daikichi':
        lines.push(`${w} drew Daikichi: a bonus, automatically correct. ${verb(r.uid, 'You recover', `${w} recovers`)} ${r.heal} life.`);
        break;
      case 'correct':
        lines.push(`${w} answered ${formatNumber(r.guess ?? 0)}: exactly right!`);
        lines.push(r.heal > 0 ? `${verb(r.uid, 'You recover', `${w} recovers`)} ${r.heal} life.` : 'No life lost.');
        break;
      case 'wrong':
        lines.push(`${w} answered ${formatNumber(r.guess ?? 0)}. The answer was ${formatNumber(r.answer ?? 0)}.`);
        break;
      case 'no-answer':
        lines.push(`${w} did not answer in time. The answer was ${formatNumber(r.answer ?? 0)}.`);
        break;
      case 'no-draw':
        lines.push(`${w} did not draw a slip in time.`);
        break;
    }
    if (r.loss > 0) lines.push(`${verb(r.uid, 'You lose', `${w} loses`)} ${r.loss} life.`);
    const splash = Object.entries(r.splash);
    if (splash.length > 0) {
      const same = splash.every(([, v]) => v === splash[0][1]);
      if (same && splash.length > 1) lines.push(`Everyone else loses ${splash[0][1]} life.`);
      else for (const [id, v] of splash) lines.push(`${who(id)} ${verb(id, 'lose', 'loses')} ${v} life.`);
    }
    for (const id of r.died) lines.push(`${who(id)} ${verb(id, 'are', 'is')} out!`);
    return lines;
  };

  const covered = offeredSlips(st.seed, st.turn, st.taken); // the 20 slips on the pane this turn
  const showSlip = (st.phase === 'answer' || st.phase === 'reveal') && !!slip && !!tier && !!question;

  return (
    <View style={styles.root}>
      <Text style={styles.meta}>
        Turn {st.turn} · {DECK_SIZE - st.taken.length} slips left
      </Text>

      {/* The players and their life */}
      <View style={styles.players}>
        {st.order.map((id) => {
          const out = !st.alive.includes(id);
          const lives = st.lives[id] ?? 0;
          const pct = Math.max(0, Math.min(1, lives / GAME_LIVES));
          return (
            <View
              key={id}
              style={[
                styles.player,
                id === highlighted && !out && styles.playerOnTheClock,
                id === uid && styles.playerMe,
                out && { opacity: 0.4 },
              ]}
            >
              <View style={styles.playerTop}>
                <Text style={styles.playerName} numberOfLines={1}>
                  {room.usernames[id] ?? 'A player'}
                  {id === uid ? ' (you)' : ''}
                </Text>
                <Text style={styles.playerLife}>{out ? 'OUT' : lives}</Text>
              </View>
              <View style={styles.lifeTrack}>
                <View
                  style={[
                    styles.lifeFill,
                    { width: `${Math.round(pct * 100)}%`, backgroundColor: pct > 0.5 ? p.lifeGood : pct > 0.25 ? p.lifeMid : p.lifeLow },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* Choosing / the temple */}
      {(st.phase === 'choosing' || st.phase === 'temple') && (
        <View style={styles.stage}>
          <Pressable
            onPress={() => send('open')}
            disabled={!(st.phase === 'temple' && mine)}
            accessibilityRole="button"
            accessibilityLabel="Open the temple"
            style={[styles.temple, st.phase === 'temple' && mine && styles.templeActive]}
          >
            <ShrineIcon glow={st.phase === 'temple' && mine} />
          </Pressable>
          {st.phase === 'choosing' && (
            <Text style={styles.stageText}>{roulette ? 'The temple is choosing a player…' : `${name(st.current)} was chosen!`}</Text>
          )}
          {st.phase === 'temple' && (
            <>
              <Text style={styles.stageTitle}>{mine ? 'Tap the temple to draw your fortune' : `${name(st.current)} will draw a fortune`}</Text>
              <Text style={styles.stageText}>{mine ? `The slips open by themselves in ${secondsLeft(left)}s` : 'Waiting for the temple to open…'}</Text>
            </>
          )}
        </View>
      )}

      {/* Picking a covered slip: the pane slides in from the left */}
      {st.phase === 'pick' && (
        <View style={styles.stage}>
          <Text style={styles.stageTitle}>
            {mine ? 'Pick a fortune slip!' : `${name(st.current)} is picking a slip…`}
          </Text>
          <Text style={[styles.timer, left < 4000 && { color: p.hot }]}>
            {secondsLeft(left)}s{mine ? ` · too slow loses ${PICK_PENALTY} life` : ''}
          </Text>
          <View style={styles.paneRow}>
            <Animated.View style={[styles.pane, { transform: [{ translateX: slide }] }]}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 280 }} contentContainerStyle={styles.paneGrid}>
                {covered.map((i, pos) => (
                  <Pressable
                    key={i}
                    onPress={() => send('pick', { slip: i })}
                    disabled={!mine}
                    accessibilityRole="button"
                    accessibilityLabel={`Fortune slip ${pos + 1}`}
                    style={({ pressed }) => [styles.coveredSlip, !mine && { opacity: 0.6 }, pressed && { opacity: 0.7 }]}
                  >
                    <View style={styles.seal} />
                    <Text style={styles.coveredNo}>{pos + 1}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>
            <View style={styles.paneSide}>
              <ShrineIcon scale={0.7} />
              <Text style={styles.stageText}>Pick one of {covered.length} covered slips</Text>
            </View>
          </View>
        </View>
      )}

      {/* The slip everybody can read */}
      {showSlip && slip && tier && question && (
        <View style={[styles.slip, { borderColor: TIER_INK[slip.tier] }]}>
          <Text style={[styles.slipKanji, { color: TIER_INK[slip.tier] }]} accessibilityLabel={tier.english}>
            {tier.kanji}
          </Text>
          <Text style={[styles.slipEnglish, { color: TIER_INK[slip.tier] }]}>{tier.english}</Text>
          <Text style={styles.slipFortune}>“{question.fortune}”</Text>
          <View style={styles.slipRule} />
          {tier.auto ? (
            <Text style={styles.slipQuestion}>A bonus slip: no question. It counts as correct.</Text>
          ) : (
            <Text style={styles.slipQuestion}>{question.q}</Text>
          )}
          <Text style={styles.slipBy}>Drawn by {name(st.current)}</Text>
          {st.phase === 'answer' && (
            <Text style={[styles.timer, styles.slipTimer, left < 8000 && { color: p.hotOnPaper }]}>
              {secondsLeft(left)}s of {secondsLeft(ANSWER_MS)}s
            </Text>
          )}
        </View>
      )}

      {/* The answer box (only for the player who drew) */}
      {st.phase === 'answer' && mine && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Your answer (a whole number)</Text>
          {!!question && !tier?.auto && (
            <View style={styles.askCard}>
              <Text style={styles.askText}>{question.q}</Text>
            </View>
          )}
          <Text style={[styles.panelTimer, left < 8000 && { color: p.hot }]}>
            {secondsLeft(left)}s of {secondsLeft(ANSWER_MS)}s
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={(t) => setText(t.replace(/\D/g, '').slice(0, 12))}
              onSubmitEditing={submitAnswer}
              autoFocus
              keyboardType="number-pad"
              returnKeyType="send"
              maxLength={12}
              placeholder="Type a number"
              placeholderTextColor={p.inkMuted}
              style={styles.input}
            />
            <Pressable onPress={submitAnswer} accessibilityRole="button" style={styles.sendButton}>
              <Text style={styles.sendText}>Answer</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>{text ? formatNumber(Number(text)) : ' '}</Text>
        </View>
      )}
      {st.phase === 'answer' && !mine && (
        <Text style={styles.note}>{name(st.current)} is answering…</Text>
      )}

      {/* What happened, for everybody */}
      {st.phase === 'reveal' && result && (
        <View style={styles.reveal}>
          {resultLines(result).map((line, i) => (
            <Text key={i} style={[styles.revealLine, i === 0 && { color: p.paper, fontWeight: '800' }]}>
              {line}
            </Text>
          ))}
        </View>
      )}

      {st.phase === 'over' && (
        <View style={styles.over}>
          <Text style={styles.overText}>
            {st.winner
              ? st.alive.length > 1
                ? `${name(st.winner)} has the most life and wins!`
                : `${name(st.winner)} survives and wins!`
              : st.alive.length === 0
                ? 'Nobody survived.'
                : 'Nobody wins: it is a tie.'}
          </Text>
        </View>
      )}

      {st.lastLeft && st.phase !== 'over' && <Text style={styles.note}>{name(st.lastLeft)} left the game.</Text>}
      {!alive && st.phase !== 'over' && <Text style={styles.note}>You are out. Watching the game…</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  waiting: { alignItems: 'center', gap: 6, paddingVertical: 30 },
  waitingTitle: { color: p.paper, fontFamily: FONT_FORTUNE, fontSize: 18, fontWeight: '700' },
  waitingText: { color: p.textSoft, fontFamily: FONT_FORTUNE, fontSize: 15 },
  meta: { color: p.textSoft, fontFamily: FONT_FORTUNE, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  players: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  player: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: p.wood,
    borderWidth: 2,
    borderColor: p.woodEdge,
    borderRadius: 8,
    padding: 8,
    gap: 6,
  },
  playerOnTheClock: { borderColor: p.lantern, borderWidth: 3 },
  playerMe: { backgroundColor: p.woodLight },
  playerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  playerName: { color: p.textSoft, fontFamily: FONT_FORTUNE, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  playerLife: { color: p.paper, fontFamily: FONT_FORTUNE, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  lifeTrack: { height: 6, borderRadius: 3, backgroundColor: '#120A06', overflow: 'hidden' },
  lifeFill: { height: 6, borderRadius: 3 },
  stage: {
    backgroundColor: p.wood,
    borderWidth: 2,
    borderColor: p.gold,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 8,
  },
  temple: { alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 20, borderWidth: 3, borderColor: 'transparent' },
  templeActive: { borderColor: p.lantern },
  stageTitle: { color: p.paper, fontFamily: FONT_FORTUNE, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  stageText: { color: p.textSoft, fontFamily: FONT_FORTUNE, fontSize: 14, textAlign: 'center' },
  timer: { color: p.lantern, fontFamily: FONT_FORTUNE, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  slipTimer: { color: p.vermilionDeep },
  paneRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', overflow: 'hidden' },
  pane: {
    flex: 3,
    backgroundColor: '#150D08',
    borderWidth: 1,
    borderColor: p.woodEdge,
    borderRadius: 8,
    padding: 8,
  },
  paneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paneSide: { flex: 2, alignItems: 'center', justifyContent: 'center', gap: 6 },
  coveredSlip: {
    width: 48,
    height: 64,
    borderRadius: 4,
    backgroundColor: '#E8D9B0',
    borderWidth: 1,
    borderColor: '#B89B5E',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  seal: { position: 'absolute', top: 6, width: 8, height: 22, borderRadius: 2, backgroundColor: '#B23A3A' },
  coveredNo: { color: '#6B4F1D', fontSize: 11, fontWeight: '700' },
  slip: {
    backgroundColor: p.paper,
    borderWidth: 3,
    borderRadius: 6,
    padding: 16,
    gap: 10,
    alignItems: 'center',
  },
  slipKanji: { fontFamily: FONT_FORTUNE, fontSize: 72, fontWeight: '900', lineHeight: 84, textAlign: 'center' },
  slipEnglish: { fontFamily: FONT_FORTUNE, fontSize: 14, fontWeight: '700', letterSpacing: 1, textAlign: 'center', marginTop: -4 },
  slipFortune: { color: p.ink, fontFamily: FONT_FORTUNE, fontSize: 16, fontStyle: 'italic', textAlign: 'center', lineHeight: 24 },
  slipRule: { alignSelf: 'stretch', height: 2, backgroundColor: p.paperEdge },
  slipQuestion: { color: p.ink, fontFamily: FONT_FORTUNE, fontSize: 18, fontWeight: '700', textAlign: 'center', lineHeight: 26 },
  slipBy: { color: p.inkMuted, fontFamily: FONT_FORTUNE, fontSize: 13 },
  panel: {
    gap: 8,
    backgroundColor: p.wood,
    borderWidth: 2,
    borderColor: p.gold,
    borderRadius: 14,
    padding: 12,
  },
  panelTitle: { color: p.paper, fontFamily: FONT_FORTUNE, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  askCard: {
    backgroundColor: p.paper,
    borderWidth: 2,
    borderColor: p.paperEdge,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  askText: { color: p.ink, fontFamily: FONT_FORTUNE, fontSize: 17, fontWeight: '700', textAlign: 'center', lineHeight: 24 },
  panelTimer: { color: p.lantern, fontFamily: FONT_FORTUNE, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    height: 46,
    color: p.ink,
    backgroundColor: p.paper,
    borderWidth: 1,
    borderColor: p.paperEdge,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
  sendButton: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: p.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: p.ink, fontFamily: FONT_FORTUNE, fontSize: 16, fontWeight: '800' },
  hint: { color: p.textSoft, fontFamily: FONT_FORTUNE, fontSize: 13, textAlign: 'center' },
  note: { color: p.lantern, fontFamily: FONT_FORTUNE, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  reveal: {
    backgroundColor: p.woodLight,
    borderWidth: 2,
    borderColor: p.lantern,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  revealLine: { color: p.textSoft, fontFamily: FONT_FORTUNE, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  over: {
    backgroundColor: p.wood,
    borderWidth: 2,
    borderColor: p.gold,
    borderRadius: 14,
    padding: 18,
  },
  overText: { color: p.gold, fontFamily: FONT_FORTUNE, fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 30 },
});
