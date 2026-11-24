import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  apply,
  cellName,
  mapFor,
  MAX_TURNS,
  newGame,
  noteFor,
  omenOf,
  optionsOf,
  publicState,
  remainingNow,
  RoomKind,
  shuffleOrder,
  SIZE,
  START_POINTS,
  State,
  tick,
} from '../game/futureSugoroku';
import * as api from '../lib/api';
import { cosmos as c, FONT_SUGOROKU } from '../gameThemes/futureSugoroku';
import type { GameProps } from './types';

// Future Sugoroku: a 5 x 5 labyrinth of rooms in a star-filled void. Everybody starts in the middle
// room (C3). Each turn you have 45 seconds to choose the next room: one of the rooms next to yours,
// never the one you just left. Every choosable room carries a note about somebody's future, and the
// note hints at how the rooms that come AFTER it look. Everybody's choice is secret until the time is
// up, then everybody moves at once and loses points (more when your chosen rooms line up with other
// players': same row, column or diagonal). Find the hidden exit on the outer ring.
//
// All the rules live in src/game/futureSugoroku.ts. The HOST's phone is the only one that runs the
// game: it applies everybody's picks (saved in lobbies/{code}/sugoroku) and saves the state, which
// every phone shows; the picks are not in the saved state until the turn is resolved. The other
// phones only show the state and send picks. If the host forfeits the game, the others cannot
// continue (known limit, same as Fortune and Xibalba). The forfeit buttons are GameScreen's.
//
// LOOK: the Ancient Cosmic Labyrinth (src/gameThemes/futureSugoroku/). Everybody sees where every
// player is. What a room IS (bonus, danger, recovery, the exit) is shown only to a player who has
// stepped into it, and only on that player's own screen. Other players' Survival Points are not
// shown (their jumps would give away what a room was).
//
// Hidden notes kept here on purpose, not on the game screen: the special rooms and what they do,
// that each effect works once per player, how a note is made (a good note: none of the rooms after it
// is a danger room; a bad note: one is), and that a safe route to the exit is guaranteed.

const PLAYER_COLORS = ['#F4C95D', '#7DF3E4', '#B58CFF', '#FF8FA3', '#7FB8FF', '#9BE08A', '#FFB86B', '#E58CFF'];
const GAP = 6; // between two rooms
const PAD = 10;
const MOVE_MS = 750; // a marker glides from one room to the next in this time
const TOKEN = 20;

const GLYPH: Record<RoomKind, string> = {
  plain: '',
  start: '⟁',
  exit: '◉',
  bonus: '✦',
  danger: '☠',
  recovery: '❖',
};
const TINT: Record<RoomKind, string> = {
  plain: c.stoneEdge,
  start: c.gold,
  exit: c.portal,
  bonus: c.bonus,
  danger: c.danger,
  recovery: c.recovery,
};

const secondsLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000));
const points = (n: number) => `${n} point${n === 1 ? '' : 's'}`;

// Where a marker sits on the grid (pixels from the top-left of the grid): the middle of its room,
// shifted a little when several players share the room.
const cellCenter = (id: number, cell: number) => ({
  x: (id % SIZE) * (cell + GAP) + cell / 2,
  y: Math.floor(id / SIZE) * (cell + GAP) + cell / 2,
});
function markerSpot(s: State, p: string, cell: number) {
  const base = cellCenter(s.pos[p], cell);
  const mates = s.order.filter((q) => s.alive.includes(q) && s.pos[q] === s.pos[p]);
  const i = Math.max(0, mates.indexOf(p));
  return { x: base.x + (i - (mates.length - 1) / 2) * (TOKEN - 4), y: base.y + cell * 0.2 };
}

export function FutureSugorokuGame({ seed, uid, onFinish, room }: GameProps) {
  const [st, setSt] = useState<State | null>(null);
  const [choice, setChoice] = useState<number | null>(null); // the room whose note I am reading
  const [lockedCell, setLockedCell] = useState<number | null>(null); // the room I locked in
  const [boardW, setBoardW] = useState(320);
  const [, setFrame] = useState(0); // re-render a few times per second for the countdown
  const receivedAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const sent = useRef(''); // the pick already sent for this turn
  const finished = useRef(false);
  const reduceMotion = useRef(false);
  // The markers gliding between rooms: one animated position per player, in grid pixels.
  const tokens = useRef<Record<string, Animated.ValueXY>>({});
  const tokenAt = useRef<Record<string, string>>({}); // where each marker was last sent, "x,y"
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
        .writeSugorokuState(r.code, round, s.ver, JSON.stringify(withClock(s)))
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

    const unsubscribe = api.subscribeSugoroku(
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
        for (const m of moves) s = apply(s, { uid: m.uid, rev: m.rev, to: m.to, at: m.at });
        if (s !== h.state) hostSet(s);
      },
      (e) => console.warn('game listener failed', e)
    );

    // HOST: the timers (picking, the reveal) and players who forfeited.
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

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion.current = v)).catch(() => {});
  }, []);

  // A new turn (or phase): nothing is read or locked yet.
  useEffect(() => {
    setChoice(null);
    setLockedCell(null);
    sent.current = '';
  }, [st?.rev]);

  // The game is over: after a moment everybody reports. Only those who escaped "finished".
  useEffect(() => {
    if (st?.phase !== 'over' || finished.current) return;
    const id = setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onFinish({ finished: st.winners.includes(uid), totalMs: Date.now() - startedAt.current });
    }, 4000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.phase, st?.winners]);

  const cell = Math.max(44, Math.min(78, Math.floor((boardW - PAD * 2 - GAP * (SIZE - 1)) / SIZE)));

  // The markers glide from room to room when a turn is resolved. Everybody sees everybody.
  useEffect(() => {
    if (!st) return;
    const anims: Animated.CompositeAnimation[] = [];
    for (const p of st.order) {
      if (!st.alive.includes(p)) continue;
      const to = markerSpot(st, p, cell);
      const key = `${to.x},${to.y}`;
      const tv = tokens.current[p];
      if (!tv) {
        tokens.current[p] = new Animated.ValueXY(to);
        tokenAt.current[p] = key;
      } else if (tokenAt.current[p] !== key) {
        tokenAt.current[p] = key;
        if (reduceMotion.current) tv.setValue(to);
        else anims.push(Animated.timing(tv, { toValue: to, duration: MOVE_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }));
      }
    }
    if (anims.length) Animated.parallel(anims).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.rev, cell]);

  if (!room) {
    return (
      <View style={styles.waiting}>
        <Text style={styles.waitingTitle}>Future Sugoroku needs other players</Text>
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

  const map = mapFor(st.seed);
  const name = (id: string) => room.usernames[id] ?? 'A player';
  const who = (id: string) => (id === uid ? 'You' : name(id));
  const colorOf = (id: string) => PLAYER_COLORS[Math.max(0, st.order.indexOf(id)) % PLAYER_COLORS.length];
  const left = remainingNow(st, receivedAt.current, Date.now());
  const alive = st.alive.includes(uid);
  const picking = st.phase === 'pick';
  const canPick = picking && alive;
  const rev = st.reveal;
  const myPos = st.pos[uid];
  const myPrev = st.prev[uid];
  const options = canPick ? optionsOf(st, uid) : [];
  const stood = new Set(st.stood[uid] ?? []); // the rooms I found out by stepping in
  const gridW = SIZE * cell + (SIZE - 1) * GAP;

  const lockIn = (to: number) => {
    if (!canPick || !options.includes(to)) return;
    setLockedCell(to);
    const key = `${st.rev}:${to}`;
    if (sent.current === key) return;
    sent.current = key;
    api
      .sendSugorokuMove(room.code, { matchId: room.matchId, roundNo: room.roundNo }, { rev: st.rev, to })
      .catch((e) => {
        sent.current = '';
        setLockedCell(null);
        console.warn('pick failed', e);
      });
  };

  // What the reveal says about me; the others only get what everybody can see (the cost of the turn).
  const myLines = (): string[] => {
    const mine = rev?.steps.find((x) => x.uid === uid);
    if (!mine) return [];
    if (mine.escaped) return ['You found the exit!'];
    const lines: string[] = [];
    if (!mine.moved) {
      lines.push(`You did not choose in time and stayed in ${cellName(mine.to)}. It cost ${points(mine.cost)}.`);
    } else {
      const extra = mine.aligned > 0 ? ` You lined up with ${mine.aligned} other player${mine.aligned === 1 ? '' : 's'}.` : '';
      lines.push(`You moved to ${cellName(mine.to)}. It cost ${points(mine.cost)}.${extra}`);
    }
    const pts = Math.abs(mine.delta);
    if (mine.effect === 'bonus') lines.push(`A lucky room: +${pts} Survival Points.`);
    else if (mine.effect === 'danger') lines.push(`A dangerous room: −${pts} Survival Points.`);
    else if (mine.effect === 'recovery') lines.push(`A restful room: +${pts} Survival Points.`);
    if (rev?.out.includes(uid)) lines.push('You ran out of Survival Points.');
    return lines;
  };

  const overText = () => {
    if (st.winners.length === 0) return 'Nobody found the exit.';
    if (st.winners.length === 1) {
      const w = st.winners[0];
      return `${who(w)} ${w === uid ? 'find' : 'finds'} the exit!`;
    }
    return `${st.winners.map(who).join(' and ')} find the exit together. A shared victory!`;
  };

  // ------------------------------------------------------------ board ----
  const renderRoom = (id: number) => {
    const known = stood.has(id);
    const kind: RoomKind = known ? map.kinds[id] : 'plain';
    const isOption = options.includes(id);
    const isPrev = canPick && id === myPrev;
    const reading = choice === id;
    const lockedHere = lockedCell === id;
    const centerGlyph = isOption ? '✎' : isPrev ? '⊘' : known ? GLYPH[kind] : '';
    const centerColor = isOption ? c.portal : isPrev ? c.rune : TINT[kind];
    return (
      <Pressable
        key={id}
        onPress={() => setChoice(id)}
        disabled={!isOption}
        accessibilityRole="button"
        accessibilityLabel={`Room ${cellName(id)}${isOption ? ', read its note' : ''}`}
        style={({ pressed }) => [
          styles.room,
          { width: cell, height: cell, marginRight: id % SIZE === SIZE - 1 ? 0 : GAP, marginBottom: GAP },
          known && { borderColor: TINT[kind] },
          id === myPos && styles.roomHere,
          isOption && styles.roomOption,
          reading && styles.roomReading,
          lockedHere && styles.roomLocked,
          pressed && isOption && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.coord}>{cellName(id)}</Text>
        {isOption && known && GLYPH[kind] !== '' && <Text style={[styles.cornerGlyph, { color: TINT[kind] }]}>{GLYPH[kind]}</Text>}
        {centerGlyph !== '' && <Text style={[styles.glyph, { color: centerColor, fontSize: cell * 0.4 }]}>{centerGlyph}</Text>}
        {centerGlyph === '' && !known && <Text style={styles.fogMark}>·</Text>}
      </Pressable>
    );
  };

  const sp = st.sp[uid] ?? 0;
  const note =
    canPick && choice !== null && options.includes(choice)
      ? noteFor(st.seed, omenOf(map, myPos, choice), choice)
      : null;

  return (
    <View style={styles.root}>
      {/* The turn and the clock */}
      <View style={styles.top}>
        <View style={styles.topText}>
          <Text style={styles.turn}>
            Turn {st.turn} of {MAX_TURNS}
          </Text>
          <Text style={styles.sub}>{picking ? 'Choose your next room' : st.phase === 'reveal' ? 'Everyone moves…' : 'The labyrinth falls silent'}</Text>
        </View>
        {picking && <Text style={[styles.timer, left < 10000 && { color: c.hot }]}>{secondsLeft(left)}s</Text>}
      </View>

      {/* My Survival Points (other players' points are not shown) */}
      <View style={styles.spBox}>
        <Text style={styles.spLabel}>Survival Points</Text>
        <View style={styles.spBar}>
          <View style={[styles.spFill, { width: `${Math.max(0, Math.min(100, (sp / START_POINTS) * 100))}%` }, sp <= 4 && { backgroundColor: c.hot }]} />
        </View>
        <Text style={[styles.spNum, sp <= 4 && { color: c.hot }]}>{sp}</Text>
      </View>

      {/* The players and where they are */}
      <View style={styles.players}>
        {st.order.map((id) => {
          const out = !st.alive.includes(id);
          const ready = picking && st.locked.includes(id);
          const won = st.phase === 'over' && st.winners.includes(id);
          return (
            <View key={id} style={[styles.player, id === uid && styles.playerMe, out && !won && { opacity: 0.4 }]}>
              <View style={[styles.dot, { backgroundColor: colorOf(id) }]} />
              <Text style={styles.playerName} numberOfLines={1}>
                {name(id)}
                {id === uid ? ' (you)' : ''}
              </Text>
              <Text style={[styles.playerState, (ready || won) && { color: c.portal }]}>
                {won ? 'FREE' : out ? 'OUT' : `${cellName(st.pos[id])}${ready ? ' ✔' : ''}`}
              </Text>
            </View>
          );
        })}
      </View>

      {/* The labyrinth */}
      <View style={styles.board} onLayout={(e) => setBoardW(e.nativeEvent.layout.width)}>
        <View style={{ width: gridW }}>
          <View style={styles.grid}>{Array.from({ length: SIZE * SIZE }, (_, id) => renderRoom(id))}</View>
          {/* the markers, gliding over the rooms: everybody sees everybody */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {st.order.map((p) => {
              const tv = tokens.current[p];
              if (!tv || !st.alive.includes(p)) return null;
              return (
                <Animated.View
                  key={p}
                  style={[
                    styles.token,
                    { backgroundColor: colorOf(p) },
                    p === uid && styles.tokenMe,
                    { transform: tv.getTranslateTransform() },
                  ]}
                >
                  <Text style={styles.tokenText}>{name(p).charAt(0).toUpperCase()}</Text>
                </Animated.View>
              );
            })}
          </View>
        </View>
      </View>

      {/* The note on the wall of the room I am looking at */}
      {canPick && (
        <View style={styles.noteBox}>
          {note === null ? (
            <Text style={styles.hint}>
              Tap a glowing room to read the note on its wall.
              {myPrev >= 0 ? ` You cannot go back to ${cellName(myPrev)}.` : ''}
            </Text>
          ) : (
            <>
              <Text style={styles.noteTitle}>A NOTE ON THE WALL OF {cellName(choice!)}</Text>
              <Text style={styles.noteText}>“{note}”</Text>
              <Pressable
                onPress={() => lockIn(choice!)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.move, lockedCell === choice && styles.moveLocked, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.moveText, lockedCell === choice && { color: c.void1 }]}>
                  {lockedCell === choice ? `✔ MOVING TO ${cellName(choice!)}` : `MOVE TO ${cellName(choice!)}`}
                </Text>
              </Pressable>
              {lockedCell !== null && lockedCell !== choice && (
                <Text style={styles.hint}>You are currently set to move to {cellName(lockedCell)}.</Text>
              )}
            </>
          )}
        </View>
      )}
      {picking && alive && (
        <Text style={styles.hint}>
          {st.locked.length} of {st.alive.length} have chosen
        </Text>
      )}

      {st.phase === 'reveal' && rev && (
        <View style={styles.reveal}>
          {myLines().map((line, i) => (
            <Text key={i} style={[styles.revealLine, i === 0 && { color: c.bone, fontWeight: '800' }]}>
              {line}
            </Text>
          ))}
          <Text style={styles.revealHead}>THE COST OF THIS TURN</Text>
          {rev.steps
            .filter((x) => x.uid !== uid)
            .map((x) => (
              <Text key={x.uid} style={styles.revealLine}>
                {name(x.uid)}: −{x.escaped ? 0 : x.cost}
                {x.aligned > 0 ? `, lined up with ${x.aligned}` : ''}
                {x.escaped ? ', found the exit!' : rev.out.includes(x.uid) ? ', ran out of Survival Points' : ''}
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
      {!alive && st.phase !== 'over' && <Text style={styles.note}>You are lost in the void. Watching the game…</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  waiting: { alignItems: 'center', gap: 6, paddingVertical: 30 },
  waitingTitle: { color: c.bone, fontFamily: FONT_SUGOROKU, fontSize: 18, fontWeight: '700' },
  waitingText: { color: c.boneMuted, fontFamily: FONT_SUGOROKU, fontSize: 15 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  topText: { flex: 1, gap: 2 },
  turn: { color: c.bone, fontFamily: FONT_SUGOROKU, fontSize: 20, fontWeight: '800' },
  sub: { color: c.boneMuted, fontFamily: FONT_SUGOROKU, fontSize: 13 },
  timer: { color: c.gold, fontFamily: FONT_SUGOROKU, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  spBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spLabel: { color: c.boneMuted, fontFamily: FONT_SUGOROKU, fontSize: 13, fontWeight: '600' },
  spBar: { flex: 1, height: 10, borderRadius: 5, backgroundColor: c.panel, borderWidth: 1, borderColor: c.stoneEdge, overflow: 'hidden' },
  spFill: { height: '100%', backgroundColor: c.gold },
  spNum: { color: c.gold, fontFamily: FONT_SUGOROKU, fontSize: 20, fontWeight: '800', minWidth: 28, textAlign: 'right' },
  players: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  player: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.stoneEdge,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  playerMe: { backgroundColor: c.stone, borderColor: c.gold },
  dot: { width: 10, height: 10, borderRadius: 5 },
  playerName: { color: c.boneMuted, fontFamily: FONT_SUGOROKU, fontSize: 13, fontWeight: '600', flex: 1 },
  playerState: { color: c.boneMuted, fontFamily: FONT_SUGOROKU, fontSize: 13, fontWeight: '800' },
  board: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(7,4,26,0.72)',
    borderWidth: 2,
    borderColor: c.stoneEdge,
    borderRadius: 14,
    padding: PAD,
    alignItems: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  room: {
    borderRadius: 10,
    backgroundColor: c.stone,
    borderWidth: 2,
    borderColor: c.stoneLo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomHere: { backgroundColor: '#3A3170', borderColor: c.gold, borderWidth: 3 },
  roomOption: { backgroundColor: '#17415A', borderColor: c.portal, borderWidth: 3 },
  roomReading: { backgroundColor: '#1E5C7E', borderColor: c.goldSoft },
  roomLocked: { backgroundColor: c.gold, borderColor: c.goldSoft },
  coord: { position: 'absolute', top: 3, left: 5, color: c.rune, fontSize: 9, fontWeight: '700' },
  cornerGlyph: { position: 'absolute', top: 2, right: 5, fontSize: 12, fontWeight: '900' },
  glyph: { fontWeight: '900' },
  fogMark: { color: c.rune, fontSize: 18, opacity: 0.5 },
  token: { position: 'absolute', left: -TOKEN / 2, top: -TOKEN / 2, width: TOKEN, height: TOKEN, borderRadius: TOKEN / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.void1 },
  tokenMe: { borderWidth: 2, borderColor: c.bone },
  tokenText: { color: c.void1, fontSize: 11, fontWeight: '900' },
  noteBox: { gap: 10, backgroundColor: c.panel, borderWidth: 2, borderColor: c.portalViolet, borderRadius: 12, padding: 14 },
  noteTitle: { color: c.portalViolet, fontFamily: FONT_SUGOROKU, fontSize: 11, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
  noteText: { color: c.bone, fontFamily: FONT_SUGOROKU, fontSize: 18, lineHeight: 26, fontStyle: 'italic', textAlign: 'center' },
  move: { alignSelf: 'center', borderWidth: 2, borderColor: c.gold, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: c.stone },
  moveLocked: { backgroundColor: c.gold },
  moveText: { color: c.gold, fontFamily: FONT_SUGOROKU, fontSize: 15, fontWeight: '800' },
  hint: { color: c.portal, fontFamily: FONT_SUGOROKU, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  note: { color: c.goldSoft, fontFamily: FONT_SUGOROKU, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  reveal: { backgroundColor: c.panel, borderWidth: 2, borderColor: c.portalViolet, borderRadius: 10, padding: 14, gap: 6 },
  revealHead: { color: c.boneMuted, fontFamily: FONT_SUGOROKU, fontSize: 11, fontWeight: '800', letterSpacing: 2, textAlign: 'center', marginTop: 6 },
  revealLine: { color: c.boneMuted, fontFamily: FONT_SUGOROKU, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  over: { backgroundColor: c.panel, borderWidth: 2, borderColor: c.portal, borderRadius: 10, padding: 18 },
  overText: { color: c.portal, fontFamily: FONT_SUGOROKU, fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 30 },
});