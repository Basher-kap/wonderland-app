import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  apply,
  COLS,
  newGame,
  publicState,
  remainingNow,
  ROWS,
  shuffleOrder,
  State,
  tick,
} from '../game/xibalba';
import * as api from '../lib/api';
import { colors, radius } from '../theme';
import type { GameProps } from './types';

// Traps of Xibalba: everybody steps one line of the trapped floor at a time, all at once. Each
// player secretly picks a tile of the next line; when the time is up every step is revealed, and
// whoever stepped on a FALSE tile (or on nothing) falls. Whoever crosses the last line has to come
// back over the same tiles; then a new floor starts. The last player left wins.
//
// All the rules live in src/game/xibalba.ts. The HOST's phone is the only one that runs the game:
// it applies everybody's picks (saved in lobbies/{code}/xibalba) and saves the state, which every
// phone shows; the picks are not in the saved state until they are revealed. The other phones only
// show the state and send picks. If the host forfeits the game, the others cannot continue (known
// limit, same as Fortune and Magical Banana). The forfeit buttons are GameScreen's.
//
// Hidden notes kept here on purpose, not on the game screen: how many tiles are false on each line,
// that the picks stay secret until the time is up, that the way back is over the same tiles, and
// that only the stepped tiles are shown (and covered again after the reveal), so the way back has
// to be remembered. The screen only shows what is happening, never how it works.

const PLAYER_COLORS = ['#EF9F27', '#5DCAA5', '#AFA9EC', '#F09595', '#7FB8FF', '#E8D98B', '#C792EA', '#FF9F7A'];
const GAP = 6;
const GUTTER = 18; // the arrow that shows which line is being stepped on
const PAD = 10;

const secondsLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000));

export function XibalbaGame({ seed, uid, onFinish, room }: GameProps) {
  const [st, setSt] = useState<State | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [boardW, setBoardW] = useState(300);
  const [, setFrame] = useState(0); // re-render a few times per second for the countdown
  const receivedAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const sent = useRef(''); // the pick already sent for this step of the game
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
        .writeXibalbaState(r.code, round, s.ver, JSON.stringify(withClock(s)))
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

    const unsubscribe = api.subscribeXibalba(
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
        // HOST: start the game (or carry on from the saved state), then apply the new picks.
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
        for (const m of moves) s = apply(s, { uid: m.uid, rev: m.rev, col: m.col, at: m.at });
        if (s !== h.state) hostSet(s);
      },
      (e) => console.warn('game listener failed', e)
    );

    // HOST: the timers (10 seconds to pick, the reveal) and players who forfeited.
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

  // A new step of the game: nothing is picked yet.
  useEffect(() => {
    setChoice(null);
    sent.current = '';
  }, [st?.rev]);

  // The game is over: after a moment everybody reports. Only the last player left "finished".
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
        <Text style={styles.waitingTitle}>Traps of Xibalba needs other players</Text>
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
  const who = (id: string) => (id === uid ? 'You' : name(id));
  const colorOf = (id: string) => PLAYER_COLORS[Math.max(0, st.order.indexOf(id)) % PLAYER_COLORS.length];
  const left = remainingNow(st, receivedAt.current, Date.now());
  const alive = st.alive.includes(uid);
  const picking = st.phase === 'pick';
  const canPick = picking && alive;
  const rev = st.reveal;

  const tile = Math.max(30, Math.min(64, Math.floor((boardW - PAD * 2 - GUTTER - GAP * (COLS - 1)) / COLS)));

  const pick = (col: number) => {
    if (!canPick) return;
    setChoice(col);
    const key = `${st.rev}:${col}`;
    if (sent.current === key) return;
    sent.current = key;
    api
      .sendXibalbaMove(room.code, { matchId: room.matchId, roundNo: room.roundNo }, { rev: st.rev, col })
      .catch((e) => {
        sent.current = '';
        console.warn('pick failed', e);
      });
  };

  // What the reveal says, for everybody.
  const revealLines = (): string[] => {
    if (!rev) return [];
    const lines: string[] = [];
    for (const s of rev.steps) {
      if (s.safe) continue;
      const verb = s.uid === uid ? 'fall' : 'falls';
      lines.push(s.col === null ? `${who(s.uid)} did not step in time and ${verb}!` : `${who(s.uid)} ${verb}!`);
    }
    if (rev.event === 'crossed') lines.push('Reached the other side!');
    if (rev.event === 'home') lines.push('Made it back!');
    if (lines.length === 0) lines.push('Everybody is safe.');
    return lines;
  };

  const rows = Array.from({ length: ROWS }, (_, i) => ROWS - 1 - i); // the last line is on top

  return (
    <View style={styles.root}>
      <Text style={styles.meta}>
        Trap set {st.setNo + 1} · {st.leg === 'forward' ? 'Crossing' : 'Heading back'}
      </Text>

      {/* The players */}
      <View style={styles.players}>
        {st.order.map((id) => {
          const out = !st.alive.includes(id);
          const ready = picking && st.locked.includes(id);
          return (
            <View
              key={id}
              style={[styles.player, id === uid && styles.playerMe, out && { opacity: 0.4 }]}
            >
              <View style={[styles.dot, { backgroundColor: colorOf(id) }]} />
              <Text style={styles.playerName} numberOfLines={1}>
                {name(id)}
                {id === uid ? ' (you)' : ''}
              </Text>
              <Text style={[styles.playerState, ready && { color: colors.experience }]}>
                {out ? 'FELL' : ready ? '✔' : picking ? '…' : ''}
              </Text>
            </View>
          );
        })}
      </View>

      {/* The floor */}
      <View style={styles.board} onLayout={(e) => setBoardW(e.nativeEvent.layout.width)}>
        <View style={styles.platform}>
          <Text style={styles.platformText}>🗿</Text>
        </View>
        {rows.map((r) => {
          const active = picking && st.row === r;
          const shown = !!rev && st.phase !== 'pick' && rev.row === r;
          return (
            <View key={r} style={[styles.row, { gap: GAP }]}>
              <View style={{ width: GUTTER, alignItems: 'center' }}>
                <Text style={styles.arrow}>{active ? (st.leg === 'forward' ? '▲' : '▼') : ''}</Text>
              </View>
              {Array.from({ length: COLS }, (_, c) => {
                const here = shown ? rev!.steps.filter((x) => x.col === c) : [];
                const stepped = here.length > 0;
                const safe = stepped && here.some((x) => x.safe);
                const mine = active && choice === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => pick(c)}
                    disabled={!canPick || !active}
                    accessibilityRole="button"
                    accessibilityLabel={`Line ${r + 1}, tile ${c + 1}`}
                    style={({ pressed }) => [
                      styles.tile,
                      { width: tile, height: tile },
                      active && canPick && styles.tileActive,
                      mine && styles.tileChosen,
                      stepped && (safe ? styles.tileSafe : styles.tileTrap),
                      pressed && active && canPick && { opacity: 0.7 },
                    ]}
                  >
                    {stepped && <Text style={styles.tileMark}>{safe ? '✓' : '✕'}</Text>}
                    {stepped && (
                      <View style={styles.chips}>
                        {here.map((x) => (
                          <View key={x.uid} style={[styles.chip, { backgroundColor: colorOf(x.uid) }]}>
                            <Text style={styles.chipText}>{name(x.uid).charAt(0).toUpperCase()}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
        <View style={styles.platform}>
          <Text style={styles.platformText}>🗿</Text>
        </View>
      </View>

      {picking && (
        <Text style={[styles.timer, left < 4000 && { color: colors.danger }]}>{secondsLeft(left)}s</Text>
      )}

      {st.phase === 'reveal' && rev && (
        <View style={styles.reveal}>
          {revealLines().map((line, i) => (
            <Text key={i} style={[styles.revealLine, i === 0 && { color: colors.text, fontWeight: '800' }]}>
              {line}
            </Text>
          ))}
        </View>
      )}

      {st.phase === 'over' && (
        <View style={styles.over}>
          <Text style={styles.overText}>
            {st.winner ? `${who(st.winner)} ${st.winner === uid ? 'are' : 'is'} the last one standing!` : 'Nobody survived.'}
          </Text>
        </View>
      )}

      {st.lastLeft && st.phase !== 'over' && <Text style={styles.note}>{name(st.lastLeft)} left the game.</Text>}
      {!alive && st.phase !== 'over' && <Text style={styles.note}>You fell. Watching the game…</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  waiting: { alignItems: 'center', gap: 6, paddingVertical: 30 },
  waitingTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  waitingText: { color: colors.muted, fontSize: 15 },
  meta: { color: colors.muted, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  players: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  player: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  playerMe: { backgroundColor: colors.cardAlt },
  dot: { width: 10, height: 10, borderRadius: 5 },
  playerName: { color: colors.muted, fontSize: 13, fontWeight: '600', flex: 1 },
  playerState: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  board: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: PAD,
    gap: GAP,
  },
  platform: {
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformText: { fontSize: 20 },
  row: { flexDirection: 'row', alignItems: 'center' },
  arrow: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  tile: {
    borderRadius: 6,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileActive: { borderColor: colors.muted },
  tileChosen: { backgroundColor: colors.accent, borderColor: colors.accent },
  tileSafe: { backgroundColor: '#1F6B52', borderColor: colors.experience },
  tileTrap: { backgroundColor: '#7A2B2B', borderColor: colors.danger },
  tileMark: { color: colors.text, fontSize: 16, fontWeight: '900', lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 2 },
  chip: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  chipText: { color: colors.bg, fontSize: 9, fontWeight: '900' },
  timer: { color: colors.accent, fontSize: 22, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] },
  note: { color: colors.accent, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  reveal: {
    backgroundColor: colors.cardAlt,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.md,
    padding: 14,
    gap: 6,
  },
  revealLine: { color: colors.muted, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  over: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.md,
    padding: 18,
  },
  overText: { color: colors.accent, fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 30 },
});
