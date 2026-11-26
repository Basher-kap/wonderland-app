import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import {
  apply,
  difficultyFor,
  LISTEN_LEAD_MS,
  newGame,
  NOTE_NAMES,
  pickWinner,
  planFor,
  publicState,
  remainingNow,
  shuffleOrder,
  State,
  TILES,
  tick,
} from '../game/pianoTiles';
import * as api from '../lib/api';
import { stage as c, FONT_PIANO } from '../gameThemes/pianoTiles';
import type { GameProps } from './types';

// Piano Tiles: a piano plays a CHAIN of notes and everybody plays it back, note for note, on 8 tiles
// (2 rows x 4 columns, white and black alternating) that sound Do Re Mi Fa Sol La Ti DO. A wrong note,
// a chain cut short or running out of time puts you out. Every round the same chain repeats from the
// start with one more note (4 notes, then 5, then 6 ...) and a harder beat, until one player is left:
// the last survivor wins.
//
// All the rules live in src/game/pianoTiles.ts. The HOST's phone is the only one that runs the game:
// it applies what everybody played (saved in lobbies/{code}/piano) and saves the state, which every
// phone shows. Every phone plays the chain ITSELF from the seed (it is not in the saved state), so
// there is no sound to stream. What the players played is not in the saved state until the reveal.
// If the host forfeits the game, the others cannot continue (known limit, same as Fortune and
// Xibalba). The forfeit buttons are GameScreen's.
//
// SOUND: the 8 notes are the files assets/sounds/piano-1.wav ... piano-8.wav (synthesized piano
// tones; replace them with real piano samples under the same names whenever you like), played with
// expo-audio (npx expo install expo-audio).
//
// LOOK: the Enchanted Symphony (src/gameThemes/pianoTiles/): luminous pearl and midnight keys in a
// magical concert hall. Every note that sounds, the piano's or yours, sends a ring of light and a
// floating note up from its key.
//
// Hidden notes kept here on purpose, not on the game screen: the chain grows by one note a round (it opens
// with the scale, then goes on with random notes),
// the beat gets faster and more uneven up to the 8th round, only the notes count (not your rhythm),
// a round nobody passes is played again, and the fastest survivor wins if several clear the game.

const SOUNDS = [
  require('../../assets/sounds/pianoTiles/piano-1.wav'),
  require('../../assets/sounds/pianoTiles/piano-2.wav'),
  require('../../assets/sounds/pianoTiles/piano-3.wav'),
  require('../../assets/sounds/pianoTiles/piano-4.wav'),
  require('../../assets/sounds/pianoTiles/piano-5.wav'),
  require('../../assets/sounds/pianoTiles/piano-6.wav'),
  require('../../assets/sounds/pianoTiles/piano-7.wav'),
  require('../../assets/sounds/pianoTiles/piano-8.wav'),
];

const PAD = 10;
const GAP = 8;
const BURST_MS = 1000; // a note rises from a key and fades in this time

// A shower of light for one note: a ring that opens and a note that floats up from the key.
type Burst = { id: number; col: number; row: number; glyph: string; bad: boolean; t: Animated.Value };
const secondsLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000));
const REASON: Record<string, string> = { wrong: 'a wrong note', short: 'stopped too soon', none: 'no answer in time' };

export function PianoTilesGame({ seed, uid, onFinish, room }: GameProps) {
  const [st, setSt] = useState<State | null>(null);
  const [lit, setLit] = useState<number | null>(null); // the tile that is sounding or pressed
  const [litBad, setLitBad] = useState(false); // ... and it was a wrong note
  const [heard, setHeard] = useState(0); // notes of the melody heard so far this round
  const [entered, setEntered] = useState(''); // what I have played this round
  const [mine, setMine] = useState<'idle' | 'sent' | 'wrong'>('idle');
  const [boardW, setBoardW] = useState(320);
  const [, setFrame] = useState(0); // re-render a few times per second for the countdown
  const receivedAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const playFrom = useRef(0); // when my play phase started (my phone's clock)
  const finished = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const players = useRef<AudioPlayer[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const burstId = useRef(0);
  const reduceMotion = useRef(false);
  const roomRef = useRef(room);
  roomRef.current = room;
  const host = useRef<{ state: State | null; pending: State | null; writing: boolean }>({
    state: null,
    pending: null,
    writing: false,
  });

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion.current = v)).catch(() => {});
  }, []);

  // The 8 notes, loaded once and released when the game closes.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    players.current = SOUNDS.map((src) => createAudioPlayer(src));
    return () => {
      players.current.forEach((p) => {
        try {
          p.release();
        } catch {
          // already gone
        }
      });
      players.current = [];
    };
  }, []);

  const playNote = (i: number) => {
    const p = players.current[i];
    if (!p) return;
    try {
      p.seekTo(0);
      p.play();
    } catch {
      // a note that fails to play must not stop the game
    }
  };

  // Every note that sounds (the piano's or mine) sends a ring of light and a floating note up from its key.
  const spawnBurst = (i: number, bad: boolean) => {
    if (reduceMotion.current) return;
    const id = ++burstId.current;
    const t = new Animated.Value(0);
    const b: Burst = { id, col: i % 4, row: Math.floor(i / 4), glyph: bad ? '✕' : id % 2 ? '♪' : '♫', bad, t };
    setBursts((cur) => [...cur.slice(-11), b]);
    Animated.timing(t, { toValue: 1, duration: BURST_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() =>
      setBursts((cur) => cur.filter((x) => x.id !== id))
    );
  };

  const flash = (i: number, bad = false, ms = 240) => {
    spawnBurst(i, bad);
    setLit(i);
    setLitBad(bad);
    timers.current.push(
      setTimeout(() => {
        setLit((cur) => (cur === i ? null : cur));
        setLitBad(false);
      }, ms)
    );
  };

  // Subscribe to the game. The host also runs it.
  useEffect(() => {
    const r = roomRef.current;
    if (!r) return;
    const round = { matchId: r.matchId, roundNo: r.roundNo };
    const h = host.current;
    const withClock = (s: State): State => ({
      ...publicState(s),
      remainingMs: s.endsAt ? Math.max(0, s.endsAt - Date.now()) : 0,
    });

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
      api
        .writePianoState(r.code, round, s.ver, JSON.stringify(withClock(s)))
        .catch((e) => console.warn('saving the game failed', e))
        .finally(() => {
          h.writing = false;
          flush();
        });
    };
    const hostSet = (s: State) => {
      h.state = s;
      h.pending = s;
      show(withClock(s));
      flush();
    };

    const unsubscribe = api.subscribePiano(
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
        // HOST: start the game (or carry on from the saved state), then apply what was played.
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
        for (const m of moves) s = apply(s, { uid: m.uid, rev: m.rev, seq: m.seq, ms: m.ms, at: m.at });
        if (s !== h.state) hostSet(s);
      },
      (e) => console.warn('game listener failed', e)
    );

    // HOST: the timers (listening, playing, the reveal) and players who forfeited.
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

  // A new phase: the piano plays the melody (listen), or my board is cleared for playing it back.
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLit(null);
    setLitBad(false);
    setEntered('');
    setMine('idle');
    if (!st) return;
    if (st.phase === 'listen') {
      setHeard(0);
      const plan = planFor(st.seed, st.round, st.redo);
      plan.notes.forEach((note, k) => {
        timers.current.push(
          setTimeout(() => {
            playNote(note);
            flash(note, false, Math.min(260, Math.max(90, (plan.onsets[k + 1] ?? plan.onsets[k] + 600) - plan.onsets[k] - 40)));
            setHeard(k + 1);
          }, LISTEN_LEAD_MS + plan.onsets[k])
        );
      });
    } else if (st.phase === 'play') {
      playFrom.current = Date.now();
    }
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.rev]);

  // The game is over: after a moment everybody reports. Only those who cleared it "finished".
  useEffect(() => {
    if (st?.phase !== 'over' || finished.current) return;
    const id = setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onFinish({
        finished: st.winners.includes(uid),
        totalMs: st.times[uid] ?? 0,
        score: Math.min(1000, st.rounds[uid] ?? 0),
      });
    }, 4000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.phase, st?.winners]);

  if (!room) {
    return (
      <View style={styles.waiting}>
        <Text style={styles.waitingTitle}>Piano Tiles needs other players</Text>
        <Text style={styles.waitingText}>Create or join a lobby to play it.</Text>
      </View>
    );
  }
  if (!st) {
    return (
      <View style={styles.waiting}>
        <Text style={styles.waitingText}>The piano is warming up…</Text>
      </View>
    );
  }

  const name = (id: string) => room.usernames[id] ?? 'A player';
  const who = (id: string) => (id === uid ? 'You' : name(id));
  const left = remainingNow(st, receivedAt.current, Date.now());
  const alive = st.alive.includes(uid);
  const plan = planFor(st.seed, st.round, st.redo);
  const length = plan.notes.length;
  const listening = st.phase === 'listen';
  const playing = st.phase === 'play';
  const canPlay = playing && alive && mine === 'idle';
  const rev = st.reveal;
  const beat = Math.max(1, Math.ceil(difficultyFor(st.round) * 5));
  const tile = Math.floor((boardW - PAD * 2 - GAP * 3) / 4);
  const tileH = Math.round(tile * 1.3);
  const gridW = tile * 4 + GAP * 3;

  const hand = (seq: string, wrong: boolean) => {
    setMine(wrong ? 'wrong' : 'sent');
    api
      .sendPianoMove(
        room.code,
        { matchId: room.matchId, roundNo: room.roundNo },
        { rev: st.rev, seq, ms: Date.now() - playFrom.current }
      )
      .catch((e) => console.warn('handing in failed', e));
  };

  const press = (i: number) => {
    if (!canPlay) return;
    playNote(i);
    const next = entered + String(i);
    setEntered(next);
    const wrong = plan.expected[next.length - 1] !== String(i);
    flash(i, wrong, 260);
    if (wrong || next.length === length) hand(next, wrong);
  };

  const overText = () => {
    if (st.winners.length === 0) return 'Nobody mastered the chain.';
    if (st.winners.length === 1) return `${who(st.winners[0])} ${st.winners[0] === uid ? 'are' : 'is'} the last one standing!`;
    const w = pickWinner(st.winners.map((id) => ({ uid: id, finished: true, totalMs: st.times[id] ?? 0 })));
    const names = st.winners.map(who).join(' and ');
    return w
      ? `${names} survived every round. ${who(w)} ${w === uid ? 'were' : 'was'} the fastest!`
      : `${names} survived every round. An exact tie!`;
  };

  const renderTile = (i: number) => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const white = (row + col) % 2 === 0;
    const on = lit === i;
    return (
      <Pressable
        key={i}
        onPress={() => press(i)}
        disabled={!canPlay}
        accessibilityRole="button"
        accessibilityLabel={NOTE_NAMES[i]}
        style={({ pressed }) => [
          styles.tile,
          {
            width: tile,
            height: tileH,
            marginRight: col === 3 ? 0 : GAP,
            marginBottom: row === 0 ? GAP : 0,
            backgroundColor: white ? c.ivory : c.ebony,
            borderColor: white ? c.ivoryDeep : c.ebonyEdge,
          },
          on && (litBad ? styles.tileBad : white ? styles.tileLitWhite : styles.tileLitBlack),
          pressed && canPlay && { opacity: 0.85 },
        ]}
      >
        <View pointerEvents="none" style={[styles.shine, { backgroundColor: white ? 'rgba(255,255,255,0.85)' : 'rgba(183,156,255,0.55)' }]} />
        <Text style={[styles.tileText, { color: white ? c.ebony : c.ivory }, on && !litBad && !white && { color: c.goldBright }]}>
          {NOTE_NAMES[i]}
        </Text>
      </Pressable>
    );
  };

  const dotsFilled = listening ? heard : playing ? entered.length : 0;

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <View style={styles.topText}>
          <Text style={styles.round}>
            Round {st.round}
          </Text>
          <Text style={styles.sub}>
            {listening
              ? `Listen. The chain is ${length} notes long`
              : playing
                ? alive
                  ? mine === 'idle'
                    ? 'Play it back, note for note'
                    : mine === 'wrong'
                      ? 'A wrong note…'
                      : 'Played. Waiting for the others…'
                  : 'You are out. Watching…'
                : st.phase === 'reveal'
                  ? 'The verdict'
                  : 'The recital is over'}
          </Text>
        </View>
        <View style={styles.beat}>
          <Text style={styles.beatLabel}>BEAT</Text>
          <View style={styles.beatBars}>
            {Array.from({ length: 5 }, (_, i) => (
              <View key={i} style={[styles.beatBar, { height: 6 + i * 3 }, i < beat && { backgroundColor: c.gold }]} />
            ))}
          </View>
        </View>
        {playing && <Text style={[styles.timer, left < 5000 && { color: c.bad }]}>{secondsLeft(left)}s</Text>}
      </View>

      {/* How many notes, and how far along */}
      <View style={styles.dots}>
        {Array.from({ length }, (_, i) => (
          <View key={i} style={[styles.noteDot, i < dotsFilled && styles.noteDotOn]} />
        ))}
      </View>

      {/* The tiles: 2 rows of 4 */}
      <View style={styles.board} onLayout={(e) => setBoardW(e.nativeEvent.layout.width)}>
        <View style={{ width: gridW }}>
          <View style={styles.grid}>{Array.from({ length: TILES }, (_, i) => renderTile(i))}</View>
          {/* the light and the notes rising from the keys */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {bursts.map((b) => {
              const cx = b.col * (tile + GAP) + tile / 2;
              const cy = b.row * (tileH + GAP) + tileH / 2;
              const ring = tile * 0.9;
              const tint = b.bad ? c.bad : c.gold;
              return (
                <React.Fragment key={b.id}>
                  <Animated.View
                    style={{
                      position: 'absolute',
                      left: cx - ring / 2,
                      top: cy - ring / 2,
                      width: ring,
                      height: ring,
                      borderRadius: ring / 2,
                      borderWidth: 3,
                      borderColor: tint,
                      opacity: b.t.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0] }),
                      transform: [{ scale: b.t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.9] }) }],
                    }}
                  />
                  <Animated.Text
                    style={{
                      position: 'absolute',
                      left: cx - 12,
                      top: cy - 16,
                      width: 24,
                      textAlign: 'center',
                      fontSize: 24,
                      fontWeight: '900',
                      color: b.bad ? c.bad : b.col % 2 === 0 ? c.goldBright : c.violetSoft,
                      opacity: b.t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                      transform: [
                        { translateY: b.t.interpolate({ inputRange: [0, 1], outputRange: [0, -90] }) },
                        { translateX: b.t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, b.col % 2 === 0 ? 10 : -10, 0] }) },
                        { scale: b.t.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.4] }) },
                      ],
                    }}
                  >
                    {b.glyph}
                  </Animated.Text>
                </React.Fragment>
              );
            })}
          </View>
        </View>
      </View>

      {/* The players */}
      <View style={styles.players}>
        {st.order.map((id) => {
          const out = !st.alive.includes(id);
          const won = st.phase === 'over' && st.winners.includes(id);
          const ready = playing && st.done.includes(id);
          return (
            <View key={id} style={[styles.player, id === uid && styles.playerMe, out && !won && { opacity: 0.4 }]}>
              <Text style={styles.playerName} numberOfLines={1}>
                {name(id)}
                {id === uid ? ' (you)' : ''}
              </Text>
              <Text style={[styles.playerState, (ready || won) && { color: c.good }]}>
                {won ? 'CLEARED' : out ? 'OUT' : ready ? '✔' : playing ? '…' : `${st.rounds[id] ?? 0}`}
              </Text>
            </View>
          );
        })}
      </View>

      {st.phase === 'reveal' && rev && (
        <View style={styles.reveal}>
          <Text style={[styles.revealLine, { color: c.ivory, fontWeight: '800' }]}>
            {rev.allOut
              ? 'Nobody got it right. The recital ends in silence.'
              : rev.redo
                ? `Nobody got it right. Round ${rev.round} is played again: the same chain, a new beat.`
                : rev.failed.length === 0
                  ? `Everyone played the ${rev.length} notes perfectly.`
                  : `${rev.passed.length === 1 ? rev.passed.map(who)[0] : rev.passed.map(who).join(', ')} played all ${rev.length} notes.`}
          </Text>
          {!rev.allOut && !rev.redo &&
            rev.failed.map((f) => (
              <Text key={f.uid} style={styles.revealLine}>
                {who(f.uid)}: out, {REASON[f.reason]}.
              </Text>
            ))}
          {rev.allOut &&
            rev.failed.map((f) => (
              <Text key={f.uid} style={styles.revealLine}>
                {who(f.uid)}: {REASON[f.reason]}.
              </Text>
            ))}
        </View>
      )}

      {st.phase === 'over' && (
        <View style={styles.over}>
          <Text style={styles.overText}>{overText()}</Text>
        </View>
      )}

      {st.lastLeft && st.phase !== 'over' && <Text style={styles.note}>{name(st.lastLeft)} left the game.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  waiting: { alignItems: 'center', gap: 6, paddingVertical: 30 },
  waitingTitle: { color: c.ivory, fontFamily: FONT_PIANO, fontSize: 18, fontWeight: '700' },
  waitingText: { color: c.muted, fontFamily: FONT_PIANO, fontSize: 15 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  topText: { flex: 1, gap: 2 },
  round: { color: c.ivory, fontFamily: FONT_PIANO, fontSize: 20, fontWeight: '800' },
  sub: { color: c.muted, fontFamily: FONT_PIANO, fontSize: 13 },
  beat: { alignItems: 'center', gap: 3 },
  beatLabel: { color: c.muted, fontFamily: FONT_PIANO, fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  beatBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  beatBar: { width: 5, borderRadius: 2, backgroundColor: c.sheen },
  timer: { color: c.gold, fontFamily: FONT_PIANO, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  noteDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.sheen },
  noteDotOn: { backgroundColor: c.gold },
  board: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(9,9,14,0.8)',
    borderWidth: 2,
    borderColor: c.violet,
    borderRadius: 16,
    padding: PAD,
    alignItems: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10 },
  shine: { position: 'absolute', top: 0, left: 8, right: 8, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  tileLitWhite: { backgroundColor: c.goldBright, borderColor: c.gold, shadowColor: c.gold, shadowOpacity: 0.95, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  tileLitBlack: { backgroundColor: c.goldWash, borderColor: c.gold, shadowColor: c.gold, shadowOpacity: 0.95, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  tileBad: { backgroundColor: c.bad, borderColor: c.bad, shadowColor: c.bad, shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  tileText: { fontFamily: FONT_PIANO, fontSize: 16, fontWeight: '800' },
  players: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  player: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.ebonyEdge,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  playerMe: { borderColor: c.gold },
  playerName: { color: c.muted, fontFamily: FONT_PIANO, fontSize: 13, fontWeight: '600', flex: 1 },
  playerState: { color: c.muted, fontFamily: FONT_PIANO, fontSize: 13, fontWeight: '800' },
  note: { color: c.goldBright, fontFamily: FONT_PIANO, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  reveal: { backgroundColor: c.panel, borderWidth: 2, borderColor: c.gold, borderRadius: 10, padding: 14, gap: 6 },
  revealLine: { color: c.muted, fontFamily: FONT_PIANO, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  over: { backgroundColor: c.panel, borderWidth: 2, borderColor: c.goldBright, borderRadius: 10, padding: 18 },
  overText: { color: c.goldBright, fontFamily: FONT_PIANO, fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 30 },
});