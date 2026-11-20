import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import {
  apply,
  cleanWord,
  lastEntry,
  MAX_DRAWS,
  MAX_WORD_LENGTH,
  newGame,
  Note,
  pickStartWord,
  remainingNow,
  shuffleOrder,
  State,
  tick,
} from '../game/magicalBanana';
import * as api from '../lib/api';
import { FONT_FOOD, food as f } from '../gameThemes/foodLandTheme';
import type { GameProps } from './types';

// Magical Banana: players sit in a circle and say a word related to the previous word. The start
// word and the JUDGE button are in the box at the center; every player has a box on the circle
// that shows the word they said. Anybody can press JUDGE to have the latest word voted on.
//
// All the rules live in src/game/magicalBanana.ts. The HOST's phone is the only one that runs the
// game: it applies everybody's moves (saved in lobbies/{code}/magic) and saves the state, which
// every phone shows. The other phones only show the state and send moves. If the host forfeits
// the game, the others cannot continue (known limit). The forfeit buttons are GameScreen's.

const BOX_W = 80;
const BOX_H = 44;

const secondsLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000));

export function MagicalBananaGame({ seed, uid, onFinish, room }: GameProps) {
  const { width } = useWindowDimensions();
  const [st, setSt] = useState<State | null>(null);
  const [text, setText] = useState('');
  const [, setFrame] = useState(0); // re-render a few times per second for the countdowns
  const receivedAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const sent = useRef(''); // the move already sent for this step of the game
  const finished = useRef(false);
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
        .writeMagicState(r.code, round, s.ver, data)
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

    const unsubscribe = api.subscribeMagic(
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
            hostSet(newGame(shuffleOrder(r.playerIds, seed), pickStartWord(seed), Date.now()));
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

    // HOST: the timers (3-2-1, the 7 seconds, the voting time) and players who forfeited.
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

  // A new step of the game: the box starts empty again.
  useEffect(() => setText(''), [st?.rev]);

  // The game is over: after a moment everybody reports. Only the last player standing "finished".
  useEffect(() => {
    if (st?.phase !== 'over' || finished.current) return;
    const id = setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onFinish({ finished: st.winner === uid, totalMs: Date.now() - startedAt.current });
    }, 3000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.phase, st?.winner]);

  if (!room) {
    return (
      <View style={styles.waiting}>
        <Text style={styles.waitingTitle}>Magical Banana needs other players</Text>
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

  const name = (id: string) => room.usernames[id] ?? 'A player';
  const left = remainingNow(st, receivedAt.current, Date.now());
  const top = lastEntry(st);
  const alive = st.alive.includes(uid);
  const myTurn = st.phase === 'turn' && st.current === uid && alive;
  const canJudge = st.phase === 'turn' && alive && !!top.by && !top.judged && st.alive.some((id) => id !== top.by);
  const judge = st.judge;
  const iVote = st.phase === 'judging' && !!judge && judge.voters.includes(uid) && !(uid in judge.votes);

  const send = (kind: 'word' | 'judge' | 'vote', extra: { word?: string; vote?: 'ok' | 'no' } = {}) => {
    const key = `${kind}:${st.rev}`;
    if (sent.current === key) return;
    sent.current = key;
    api
      .sendMagicMove(room.code, { matchId: room.matchId, roundNo: room.roundNo }, { rev: st.rev, kind, ...extra })
      .catch((e) => {
        sent.current = '';
        console.warn('move failed', e);
      });
  };
  const submitWord = () => {
    const w = cleanWord(text);
    if (!w) return;
    setText('');
    send('word', { word: w });
  };

  // The circle: an ellipse, so up to 8 boxes fit without touching.
  const S = Math.min(width - 32, 360);
  const H = Math.round(S * 1.1);
  const rx = S / 2 - BOX_W / 2 - 4;
  const ry = H / 2 - BOX_H / 2 - 4;
  const n = st.order.length;

  const noteText = (note: Note | null): string => {
    if (!note) return '';
    const who = name(note.uid);
    switch (note.kind) {
      case 'ok':
        return `OK (${note.ok}-${note.no}): “${note.word}” passed.`;
      case 'draw':
        return `DRAW (${note.ok}-${note.no}): “${note.word}” was not accepted. ${who} must say another word (${note.strikes}/${MAX_DRAWS} draws).`;
      case 'no':
        return `NO (${note.ok}-${note.no}): ${who} is disqualified.`;
      case 'strike2':
        return `DRAW again: ${who} is disqualified.`;
      case 'timeout':
        return `${who} ran out of time and is disqualified.`;
      case 'forfeit':
        return `${who} left the game.`;
    }
  };

  return (
    <View style={styles.root}>
      <View style={{ width: S, height: H, alignSelf: 'center' }}>
        {/* the big plate the players sit around */}
        <View pointerEvents="none" style={[styles.plate, { left: S / 2 - rx, top: H / 2 - ry, width: rx * 2, height: ry * 2 }]} />
        {st.order.map((id, i) => {
          const angle = (2 * Math.PI * i) / n - Math.PI / 2;
          const x = S / 2 + rx * Math.cos(angle) - BOX_W / 2;
          const y = H / 2 + ry * Math.sin(angle) - BOX_H / 2;
          const out = !st.alive.includes(id);
          const onTheClock = !out && st.current === id && st.phase !== 'judging' && st.phase !== 'over';
          const draws = st.strikes[id] ?? 0;
          return (
            <View
              key={id}
              style={[
                styles.player,
                { left: x, top: y },
                onTheClock && styles.playerOnTheClock,
                id === uid && styles.playerMe,
                out && { opacity: 0.4 },
              ]}
            >
              <Text style={styles.playerName} numberOfLines={1}>
                {name(id)}
                {draws > 0 && !out ? ' ⚠' : ''}
              </Text>
              <Text style={styles.playerWord} numberOfLines={1} adjustsFontSizeToFit>
                {out ? 'OUT' : st.words[id] || ' '}
              </Text>
            </View>
          );
        })}

        {/* The initial box in the middle, with the JUDGE button */}
        <View style={[styles.center, { left: S / 2 - 65, top: H / 2 - 55 }]}>
          {st.phase === 'countdown' && <Text style={styles.centerCount}>{Math.max(1, secondsLeft(left))}</Text>}
          {st.phase === 'turn' && (
            <>
              <Text style={styles.centerLabel}>Related to</Text>
              <Text style={styles.centerWord} numberOfLines={2} adjustsFontSizeToFit>
                {top.word}
              </Text>
              <Text style={styles.centerTimer}>{secondsLeft(left)}s</Text>
            </>
          )}
          {st.phase === 'judging' && judge && (
            <>
              <Text style={styles.centerLabel}>Judging</Text>
              <Text style={styles.centerWord} numberOfLines={2} adjustsFontSizeToFit>
                {judge.word}
              </Text>
              <Text style={styles.centerTimer}>
                {Object.keys(judge.votes).length}/{judge.voters.length} voted
              </Text>
            </>
          )}
          {st.phase === 'over' && (
            <Text style={styles.centerWord} numberOfLines={3} adjustsFontSizeToFit>
              {st.winner ? `${name(st.winner)} wins!` : 'Nobody wins'}
            </Text>
          )}
          {(st.phase === 'turn' || st.phase === 'judging') && (
            <Pressable
              onPress={() => send('judge')}
              disabled={!canJudge}
              accessibilityRole="button"
              style={[styles.judgeButton, !canJudge && { opacity: 0.35 }]}
            >
              <Text style={styles.judgeText}>JUDGE</Text>
            </Pressable>
          )}
        </View>
      </View>

      {!!st.last && <Text style={styles.note}>{noteText(st.last)}</Text>}

      {myTurn && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Your turn: say a word related to “{top.word}”</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              onSubmitEditing={submitWord}
              autoFocus
              autoCorrect={false}
              maxLength={MAX_WORD_LENGTH}
              returnKeyType="send"
              placeholder="Type a word"
              placeholderTextColor={f.inkMuted}
              style={styles.input}
            />
            <Pressable onPress={submitWord} accessibilityRole="button" style={styles.sendButton}>
              <Text style={styles.sendText}>Send</Text>
            </Pressable>
          </View>
        </View>
      )}

      {iVote && judge && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>
            Is “{judge.word}” related to “{judge.prev}”?
          </Text>
          <View style={styles.inputRow}>
            <Pressable onPress={() => send('vote', { vote: 'ok' })} accessibilityRole="button" style={[styles.voteButton, styles.voteOk]}>
              <Text style={[styles.voteText, { color: f.ink }]}>OK</Text>
            </Pressable>
            <Pressable onPress={() => send('vote', { vote: 'no' })} accessibilityRole="button" style={[styles.voteButton, styles.voteNo]}>
              <Text style={[styles.voteText, { color: f.cream }]}>NO</Text>
            </Pressable>
          </View>
        </View>
      )}
      {st.phase === 'judging' && judge && !iVote && (
        <Text style={styles.note}>
          {judge.author === uid
            ? 'Your word is being judged…'
            : judge.voters.includes(uid)
              ? 'Vote sent. Waiting for the others…'
              : 'Waiting for the others…'}
        </Text>
      )}
      {!alive && st.phase !== 'over' && (
        <Text style={styles.note}>You are out. You can still vote when a word is judged.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  waiting: { alignItems: 'center', gap: 6, paddingVertical: 30 },
  waitingTitle: { color: f.cream, fontFamily: FONT_FOOD, fontSize: 18, fontWeight: '700' },
  waitingText: { color: f.textSoft, fontFamily: FONT_FOOD, fontSize: 15 },
  plate: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: 'rgba(242,138,178,0.55)',
    backgroundColor: 'rgba(255,243,220,0.08)',
  },
  player: {
    position: 'absolute',
    width: BOX_W,
    height: BOX_H,
    backgroundColor: f.cream,
    borderWidth: 2,
    borderColor: f.creamEdge,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerOnTheClock: { borderColor: f.berry, borderWidth: 3 },
  playerMe: { backgroundColor: f.custard },
  playerName: { color: f.inkMuted, fontFamily: FONT_FOOD, fontSize: 11, fontWeight: '700' },
  playerWord: { color: f.ink, fontFamily: FONT_FOOD, fontSize: 14, fontWeight: '800', maxWidth: BOX_W - 8 },
  center: {
    position: 'absolute',
    width: 130,
    height: 110,
    backgroundColor: f.cocoa,
    borderWidth: 2,
    borderColor: f.custard,
    borderRadius: 22,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  centerCount: { color: f.cream, fontFamily: FONT_FOOD, fontSize: 56, fontWeight: '900', flex: 1, textAlignVertical: 'center' },
  centerLabel: { color: '#E8CDB8', fontFamily: FONT_FOOD, fontSize: 11, fontWeight: '600' },
  centerWord: { color: f.cream, fontFamily: FONT_FOOD, fontSize: 20, fontWeight: '800', textAlign: 'center', maxWidth: 116 },
  centerTimer: { color: f.custard, fontFamily: FONT_FOOD, fontSize: 13, fontWeight: '700' },
  judgeButton: {
    backgroundColor: f.berry,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 18,
  },
  judgeText: { color: f.cream, fontFamily: FONT_FOOD, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  note: { color: f.custard, fontFamily: FONT_FOOD, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  panel: {
    gap: 8,
    backgroundColor: f.cocoa,
    borderWidth: 2,
    borderColor: f.frosting,
    borderRadius: 14,
    padding: 12,
  },
  panelTitle: { color: f.cream, fontFamily: FONT_FOOD, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    height: 46,
    color: f.ink,
    backgroundColor: f.cream,
    borderWidth: 1,
    borderColor: f.creamEdge,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 18,
  },
  sendButton: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: f.custard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: f.ink, fontFamily: FONT_FOOD, fontSize: 16, fontWeight: '800' },
  voteButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteOk: { backgroundColor: f.mint, borderColor: f.mint },
  voteNo: { backgroundColor: f.berry, borderColor: f.berry },
  voteText: { fontFamily: FONT_FOOD, fontSize: 20, fontWeight: '800' },
});
