import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  apply,
  BULLETS,
  cellName,
  GRID,
  newGame,
  publicState,
  remainingNow,
  SHIP_COUNT,
  Shot,
  shotCells,
  shuffleOrder,
  State,
  tick,
  TURN_MS,
  withShips,
} from '../game/battleships';
import * as api from '../lib/api';
import { colors, radius } from '../theme';
import type { GameProps } from './types';

// Battleships: every player secretly places 7 battleships on a 5x5 grid (15 seconds). Then the
// players take turns, in a random order, to shoot a cell of the shared grid; the mark stays on the
// cell for everybody. 5 bullets each: a miss (or hitting your own ship) loses a bullet, hitting an
// enemy battleship does not. Players remaining with a battleship clear the game.
//
// All the rules live in src/game/battleships.ts. The HOST's phone is the only one that runs the
// game: it applies everybody's moves (saved in lobbies/{code}/battleships) and saves the state
// (without the secret ship positions), which every phone shows. If the host forfeits the game the
// others cannot continue (known limit, same as Magical Banana and Fortune). The forfeit buttons are
// GameScreen's.
//
// Hidden notes kept here on purpose, not in the rules window: the layout (5x5 grid, 15 s to place,
// the grid starts empty, turns in a random order, marks seen by everybody).

// false = the grid is empty while playing and you must remember where your ships are (the brief:
// "the game starts with the empty 5x5 table grid"). true = your own ships are drawn faintly.
const SHOW_OWN_SHIPS = false;

const PLAYER_COLORS = ['#EF9F27', '#5DCAA5', '#AFA9EC', '#F09595', '#7DB8F0', '#E8D44D', '#C792EA', '#8BD17C'];

const secondsLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000));

export function BattleshipsGame({ seed, uid, onFinish, room }: GameProps) {
  const [st, setSt] = useState<State | null>(null);
  const [sel, setSel] = useState<number[]>([]); // my ships while placing
  const [ready, setReady] = useState(false); // I pressed Ready (my placement was sent)
  const [, setFrame] = useState(0); // re-render a few times per second for the countdowns
  const receivedAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const sent = useRef('');
  const finished = useRef(false);
  const mineRef = useRef<number[]>([]);
  mineRef.current = sel;
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
    const withClock = (s: State): State => ({
      ...publicState(s),
      remainingMs: s.endsAt ? Math.max(0, s.endsAt - Date.now()) : 0,
    });

    // Save the latest state (one write at a time; only the newest state matters).
    const flush = () => {
      if (h.writing || !h.pending) return;
      const s = h.pending;
      h.pending = null;
      h.writing = true;
      api
        .writeBattleshipsState(r.code, round, s.ver, JSON.stringify(withClock(s)))
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

    const unsubscribe = api.subscribeBattleships(
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
        const moves = snap.moves
          .filter((m) => m.matchId === round.matchId && m.roundNo === round.roundNo)
          .sort((a, b) => a.at - b.at);
        // HOST: start the game (or carry on from the saved one, putting the secret ships back from
        // the placement moves), then apply the new moves.
        if (!h.state) {
          if (docState) {
            h.state = withShips(docState, moves);
            show(docState);
          } else {
            hostSet(newGame(shuffleOrder(r.playerIds, seed), seed, Date.now()));
          }
        }
        let s = h.state!;
        for (const m of moves) s = apply(s, m, Date.now());
        if (s !== h.state) hostSet(s);
      },
      (e) => console.warn('game listener failed', e)
    );

    // HOST: the timers (placing, countdown, 10 seconds to shoot, the result) and players who forfeited.
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

  // The game is over: after a moment everybody reports. Only the winner "finished".
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

  const send = (kind: 'place' | 'shoot', extra: { cells?: number[]; cell?: number } = {}) => {
    const r = roomRef.current;
    if (!r || !st) return;
    const key = kind === 'place' ? 'place' : `shoot:${st.rev}`;
    if (sent.current === key) return;
    sent.current = key;
    api
      .sendBattleshipsMove(r.code, { matchId: r.matchId, roundNo: r.roundNo }, { rev: st.rev, kind, ...extra })
      .catch((e) => {
        sent.current = '';
        console.warn('move failed', e);
      });
  };

  // Time is up while placing: send what I have (the host fills in the rest at random).
  const placingLeft = st && room ? remainingNow(st, receivedAt.current, Date.now()) : 1;
  const timeUp = !!st && st.phase === 'placing' && placingLeft <= 0;
  useEffect(() => {
    if (!timeUp || ready || !st || st.placed.includes(uid)) return;
    setReady(true);
    send('place', { cells: mineRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp]);

  if (!room) {
    return (
      <View style={styles.waiting}>
        <Text style={styles.waitingTitle}>Battleships needs other players</Text>
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
  const who = (id: string) => (id === uid ? 'You' : name(id));
  const colorOf = (id: string) => PLAYER_COLORS[Math.max(0, st.order.indexOf(id)) % PLAYER_COLORS.length];
  const left = remainingNow(st, receivedAt.current, Date.now());
  const inGame = st.shipsLeft[uid] > 0 && !st.out.includes(uid);
  const mine = st.current === uid && st.phase === 'aiming' && inGame;
  const taken = shotCells(st);
  const shotAt = new Map<number, Shot>();
  for (const s of st.shots) if (s.cell !== null) shotAt.set(s.cell, s);
  const lastShot = st.shots.length > 0 ? st.shots[st.shots.length - 1] : null;
  const placing = st.phase === 'placing' && inGame;
  const locked = ready || st.placed.includes(uid);

  const toggle = (cell: number) => {
    if (!placing || locked || timeUp) return;
    setSel((cur) => (cur.includes(cell) ? cur.filter((c) => c !== cell) : cur.length < SHIP_COUNT ? [...cur, cell] : cur));
  };
  const confirm = () => {
    if (sel.length !== SHIP_COUNT || locked) return;
    setReady(true);
    send('place', { cells: sel });
  };

  const shotLine = (s: Shot): string => {
    const w = who(s.by);
    const at = s.cell === null ? '' : cellName(s.cell);
    const victims = s.victims.map(who).join(' and ');
    const lines: string[] = [];
    switch (s.outcome) {
      case 'miss':
        lines.push(`${w} shot ${at}: a miss. -1 bullet.`);
        break;
      case 'hit':
        lines.push(`${w} shot ${at} and sank ${s.victims.length === 1 ? `${victims}’s` : `${victims}’s`} battleship! No bullet lost.`);
        break;
      case 'neutral':
        lines.push(`${w} shot ${at}: ${victims}’s battleship and ${w === 'You' ? 'your' : 'their'} own were both there. Both sunk, no bullet lost.`);
        break;
      case 'own':
        lines.push(`${w} shot ${at} and hit ${w === 'You' ? 'your' : 'their'} own battleship! -1 bullet.`);
        break;
      case 'timeout':
        lines.push(`${w} ran out of time. -1 bullet.`);
        break;
    }
    for (const id of s.out) lines.push(`${who(id)} ${id === uid ? 'have' : 'has'} no battleships left and ${id === uid ? 'are' : 'is'} out!`);
    return lines.join('\n');
  };

  const markOf = (cell: number) => {
    const s = shotAt.get(cell);
    if (!s) return null;
    return s.outcome === 'miss' ? '•' : s.outcome === 'own' ? '⚠️' : '💥';
  };

  const title =
    st.phase === 'placing'
      ? locked
        ? 'Ships placed. Waiting for the others…'
        : `Place your ${SHIP_COUNT} battleships`
      : st.phase === 'countdown'
        ? 'Battle start!'
        : st.phase === 'over'
          ? 'Game over'
          : mine
            ? 'Your turn: pick a cell to shoot'
            : `${name(st.current)} is aiming…`;

  return (
    <View style={styles.root}>
      <Text style={styles.meta}>{title}</Text>

      {/* The players: battleships and bullets left */}
      <View style={styles.players}>
        {st.order.map((id) => {
          const out = st.shipsLeft[id] === 0;
          return (
            <View
              key={id}
              style={[
                styles.player,
                { borderLeftColor: colorOf(id), borderLeftWidth: 4 },
                id === st.current && st.phase === 'aiming' && !out && styles.playerOnTheClock,
                id === uid && styles.playerMe,
                out && { opacity: 0.4 },
              ]}
            >
              <Text style={styles.playerName} numberOfLines={1}>
                {room.usernames[id] ?? 'A player'}
                {id === uid ? ' (you)' : ''}
              </Text>
              {out ? (
                <Text style={styles.playerStat}>OUT</Text>
              ) : (
                <Text style={styles.playerStat}>
                  🚢 {st.shipsLeft[id]}   🔫 {'●'.repeat(st.bullets[id])}
                  <Text style={{ color: colors.border }}>{'●'.repeat(Math.max(0, BULLETS - st.bullets[id]))}</Text>
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Timer */}
      {(st.phase === 'placing' || st.phase === 'aiming' || st.phase === 'countdown') && (
        <Text style={[styles.timer, left < 4000 && st.phase !== 'countdown' && { color: colors.danger }]}>
          {st.phase === 'placing'
            ? `${secondsLeft(left)}s · ${sel.length}/${SHIP_COUNT} placed`
            : st.phase === 'countdown'
              ? `${Math.max(1, secondsLeft(left))}`
              : `${secondsLeft(left)}s of ${secondsLeft(TURN_MS)}s${mine ? ' · too slow loses a bullet' : ''}`}
        </Text>
      )}

      {/* The grid */}
      <View style={styles.gridWrap}>
        <View style={styles.colHeader}>
          <View style={styles.rowLabel} />
          {Array.from({ length: GRID }, (_, c) => (
            <Text key={c} style={styles.axis}>
              {c + 1}
            </Text>
          ))}
        </View>
        {Array.from({ length: GRID }, (_, r) => (
          <View key={r} style={styles.gridRow}>
            <Text style={[styles.axis, styles.rowLabel]}>{String.fromCharCode(65 + r)}</Text>
            {Array.from({ length: GRID }, (_, c) => {
              const cell = r * GRID + c;
              const shot = shotAt.get(cell);
              const placedHere = (placing || (SHOW_OWN_SHIPS && !shot)) && sel.includes(cell);
              const canShoot = mine && !taken.includes(cell);
              return (
                <Pressable
                  key={c}
                  onPress={() => (placing ? toggle(cell) : canShoot ? send('shoot', { cell }) : undefined)}
                  disabled={placing ? locked : !canShoot}
                  accessibilityRole="button"
                  accessibilityLabel={`Cell ${cellName(cell)}`}
                  style={({ pressed }) => [
                    styles.cell,
                    shot && { backgroundColor: colorOf(shot.by) + '55', borderColor: colorOf(shot.by) },
                    placedHere && styles.cellShip,
                    placedHere && !placing && { opacity: 0.45 },
                    canShoot && styles.cellAim,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  {placedHere ? <Text style={styles.cellMark}>🚢</Text> : null}
                  {shot ? <Text style={styles.cellMark}>{markOf(cell)}</Text> : null}
                  {shot ? <Text style={[styles.cellBy, { color: colorOf(shot.by) }]}>{name(shot.by).slice(0, 1).toUpperCase()}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {placing && !locked && (
        <Pressable
          onPress={confirm}
          disabled={sel.length !== SHIP_COUNT}
          accessibilityRole="button"
          style={[styles.button, sel.length !== SHIP_COUNT && { opacity: 0.4 }]}
        >
          <Text style={styles.buttonText}>{sel.length === SHIP_COUNT ? 'Ready' : `Place ${SHIP_COUNT - sel.length} more`}</Text>
        </Pressable>
      )}

      {/* The last shot, for everybody */}
      {lastShot && st.phase !== 'placing' && (
        <View style={styles.reveal}>
          <Text style={styles.revealLine}>{shotLine(lastShot)}</Text>
        </View>
      )}

      {st.phase === 'over' && (
        <View style={styles.over}>
          <Text style={styles.overText}>
            {st.winner
              ? `${name(st.winner)} wins with ${st.shipsLeft[st.winner]} battleship${st.shipsLeft[st.winner] === 1 ? '' : 's'} left!`
              : afloatNone(st)
                ? 'Nobody has a battleship left.'
                : 'Nobody wins: it is a tie.'}
          </Text>
        </View>
      )}

      {st.out.length > 0 && st.phase !== 'over' && <Text style={styles.note}>{st.out.map(name).join(', ')} left the game.</Text>}
      {!inGame && st.phase !== 'over' && st.phase !== 'placing' && <Text style={styles.note}>You are out. Watching the game…</Text>}
    </View>
  );
}

const afloatNone = (s: State) => s.order.every((id) => s.shipsLeft[id] === 0);

const styles = StyleSheet.create({
  root: { gap: 12 },
  waiting: { alignItems: 'center', gap: 6, paddingVertical: 30 },
  waitingTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  waitingText: { color: colors.muted, fontSize: 15 },
  meta: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  players: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  player: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 8,
    gap: 4,
  },
  playerOnTheClock: { borderColor: colors.accent, borderWidth: 2 },
  playerMe: { backgroundColor: colors.cardAlt },
  playerName: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  playerStat: { color: colors.text, fontSize: 15, fontWeight: '700' },
  timer: { color: colors.accent, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  gridWrap: { alignSelf: 'center', width: '100%', maxWidth: 360, gap: 6 },
  colHeader: { flexDirection: 'row', gap: 6 },
  gridRow: { flexDirection: 'row', gap: 6 },
  rowLabel: { width: 18 },
  axis: { flex: 1, color: colors.muted, fontSize: 13, fontWeight: '700', textAlign: 'center', alignSelf: 'center' },
  cell: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellShip: { backgroundColor: colors.cardAlt, borderColor: colors.chance },
  cellAim: { borderColor: colors.accent, borderWidth: 2 },
  cellMark: { fontSize: 22, color: colors.text },
  cellBy: { position: 'absolute', top: 2, right: 4, fontSize: 10, fontWeight: '800' },
  button: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: colors.bg, fontSize: 16, fontWeight: '800' },
  reveal: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    gap: 4,
  },
  revealLine: { color: colors.text, fontSize: 14, fontWeight: '600' },
  over: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.chance, borderRadius: radius.md, padding: 14 },
  overText: { color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  note: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});
