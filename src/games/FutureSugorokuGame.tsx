import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  apply,
  exitsFor,
  mapFor,
  MAX_TURNS,
  neighbors,
  newGame,
  publicState,
  remainingNow,
  RoomKind,
  seenBy,
  shownKind,
  shuffleOrder,
  SIZE,
  START,
  START_POINTS,
  State,
  doorKey,
  tick,
} from '../game/futureSugoroku';
import * as api from '../lib/api';
import { cosmos as c, FONT_SUGOROKU } from '../gameThemes/futureSugoroku';
import type { GameProps } from './types';

// Future Sugoroku: a 5 x 5 labyrinth of chambers in a star-filled void. One die is rolled for
// everybody each turn; you may only walk through a doorway whose number is the die. Everybody
// picks a chamber in secret, then all the steps happen at once. Reach the portal within 15 turns
// and before your Survival Points run out.
//
// All the rules live in src/game/futureSugoroku.ts. The HOST's phone is the only one that runs the
// game: it applies everybody's picks (saved in lobbies/{code}/sugoroku) and saves the state, which
// every phone shows; the picks are not in the saved state until the turn is resolved. The other
// phones only show the state and send picks. If the host forfeits the game, the others cannot
// continue (known limit, same as Fortune and Xibalba). The forfeit buttons are GameScreen's.
//
// LOOK: the Ancient Cosmic Labyrinth (src/gameThemes/futureSugoroku/). Only the chambers you stand
// in and the ones next to them are visible; the others appear as you explore, and you remember
// them. Doorways show their number only for the chambers you have stood in. The portal is HIDDEN: it
// is on the outer ring and shows up only when it is in a chamber you can see.
//
// Hidden notes kept here on purpose, not on the game screen: the special rooms and what they do,
// that each effect works once per player, that a locked room opens for everybody after one try,
// that an illusion room looks like a bonus room, and that a safe route is guaranteed.

const PLAYER_COLORS = ['#F4C95D', '#7DF3E4', '#B58CFF', '#FF8FA3', '#7FB8FF', '#9BE08A', '#FFB86B', '#E58CFF'];
const GAP = 6;
const DOOR = 22; // the space between two chambers: it holds the doorway
const PAD = 10;
const ROLL_MS = 1100; // the die tumbles this long before it shows its face
const MOVE_MS = 750; // a marker glides from one chamber to the next in this time
const TOKEN = 18;

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const GLYPH: Record<RoomKind, string> = {
  plain: '',
  start: '⟁',
  exit: '◉',
  bonus: '✦',
  danger: '☠',
  recovery: '❖',
  locked: '▣',
  illusion: '✦', // never shown as such until exposed, see below
};
const TINT: Record<RoomKind, string> = {
  plain: c.stoneEdge,
  start: c.gold,
  exit: c.portal,
  bonus: c.bonus,
  danger: c.danger,
  recovery: c.recovery,
  locked: c.locked,
  illusion: c.illusion,
};

const secondsLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000));

// The die. While it rolls it tumbles (spins, hops, grows a little) and flickers through random faces;
// `spin` runs from 0 to 1 over the roll.
function Die({ value, rolling, spin }: { value: number; rolling: boolean; spin: Animated.Value }) {
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] });
  const hop = spin.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [0, -18, 0, -10, 0, 0] });
  const grow = spin.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 1], outputRange: [1, 1.2, 1, 1.1, 1] });
  return (
    <Animated.View
      style={[
        styles.die,
        rolling && styles.dieRolling,
        { transform: [{ translateY: hop }, { rotate }, { scale: grow }] },
      ]}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <View key={i} style={styles.pipCell}>
          {PIPS[value]?.includes(i) && <View style={styles.pip} />}
        </View>
      ))}
    </Animated.View>
  );
}

// Where a marker sits on the grid (pixels from the top-left of the grid): the middle of its chamber,
// shifted a little when several players share the chamber.
const cellCenter = (id: number, cell: number) => ({
  x: (id % SIZE) * (cell + DOOR) + cell / 2,
  y: Math.floor(id / SIZE) * (cell + DOOR) + cell / 2,
});
function markerSpot(s: State, p: string, cell: number) {
  const base = cellCenter(s.pos[p], cell);
  const mates = s.order.filter((q) => s.alive.includes(q) && s.pos[q] === s.pos[p]);
  const i = Math.max(0, mates.indexOf(p));
  return { x: base.x + (i - (mates.length - 1) / 2) * (TOKEN - 2), y: base.y + cell * 0.18 };
}

export function FutureSugorokuGame({ seed, uid, onFinish, room }: GameProps) {
  const [st, setSt] = useState<State | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [boardW, setBoardW] = useState(300);
  const [, setFrame] = useState(0); // re-render a few times per second for the countdown
  const receivedAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const sent = useRef(''); // the pick already sent for this turn
  const finished = useRef(false);
  // The die rolling.
  const [rolling, setRolling] = useState(false);
  const [rollFace, setRollFace] = useState(1);
  const spin = useRef(new Animated.Value(1)).current;
  const lastRolled = useRef(0); // the turn the die last rolled for
  const reduceMotion = useRef(false);
  // The markers gliding between chambers: one animated position per player, in grid pixels.
  const tokens = useRef<Record<string, Animated.ValueXY>>({});
  const tokenAt = useRef<Record<string, string>>({}); // where each marker was last sent, "x,y"
  const wasSeen = useRef<Record<string, boolean>>({}); // whether the marker was in my sight last time
  const bumped = useRef(-1); // the rev whose locked door / illusion bumps were already played
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

  // A new turn (or phase): nothing is picked yet.
  useEffect(() => {
    setChoice(null);
    sent.current = '';
  }, [st?.rev]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion.current = v)).catch(() => {});
  }, []);

  // A new turn begins: the shared die rolls. The doorways light up only when it has landed.
  useEffect(() => {
    if (!st || st.phase !== 'pick' || lastRolled.current === st.turn) return;
    if (reduceMotion.current) {
      lastRolled.current = st.turn;
      return;
    }
    const turn = st.turn;
    setRolling(true);
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: ROLL_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const flicker = setInterval(() => setRollFace(1 + Math.floor(Math.random() * 6)), 90);
    const done = setTimeout(() => {
      lastRolled.current = turn;
      clearInterval(flicker);
      setRolling(false);
    }, ROLL_MS);
    return () => {
      clearInterval(flicker);
      clearTimeout(done);
      setRolling(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.turn, st?.phase]);

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

  const cellPx = Math.max(36, Math.min(62, Math.floor((boardW - PAD * 2 - DOOR * (SIZE - 1)) / SIZE)));

  // The markers glide from chamber to chamber when a turn is resolved (a marker I cannot see
  // just jumps, so nothing is given away), and bump against a locked door or an illusion.
  useEffect(() => {
    if (!st) return;
    const myCell = st.pos[uid] ?? START;
    const iSee = (cellId: number) => !st.alive.includes(uid) || cellId === myCell || neighbors(myCell).includes(cellId);
    const anims: Animated.CompositeAnimation[] = [];
    for (const p of st.order) {
      if (!st.alive.includes(p)) continue;
      const to = markerSpot(st, p, cellPx);
      const key = `${to.x},${to.y}`;
      const sees = iSee(st.pos[p]);
      const tv = tokens.current[p];
      if (!tv) {
        tokens.current[p] = new Animated.ValueXY(to);
        tokenAt.current[p] = key;
      } else if (tokenAt.current[p] !== key) {
        tokenAt.current[p] = key;
        if (sees && wasSeen.current[p] && !reduceMotion.current) {
          anims.push(Animated.timing(tv, { toValue: to, duration: MOVE_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }));
        } else {
          tv.setValue(to);
        }
      }
      wasSeen.current[p] = sees;
    }
    // A locked door shoves the marker back; an illusion lets it walk in and throws it out again.
    if (st.phase === 'reveal' && st.reveal && bumped.current !== st.rev && !reduceMotion.current) {
      bumped.current = st.rev;
      for (const step of st.reveal.steps) {
        const tv = tokens.current[step.uid];
        if (!tv || step.tried === null || !iSee(step.from) || !st.alive.includes(step.uid)) continue;
        const home = markerSpot(st, step.uid, cellPx);
        const a = cellCenter(step.from, cellPx);
        const b = cellCenter(step.tried, cellPx);
        const k = step.outcome === 'illusion' ? 1 : 0.4;
        const far = { x: home.x + (b.x - a.x) * k, y: home.y + (b.y - a.y) * k };
        const t = step.outcome === 'illusion' ? 450 : 260;
        anims.push(
          Animated.sequence([
            Animated.timing(tv, { toValue: far, duration: t, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(tv, { toValue: home, duration: t, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ])
        );
      }
    }
    if (anims.length) Animated.parallel(anims).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.rev, cellPx]);

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
  const canPick = picking && alive && !rolling; // the doorways light up once the die has landed
  const rev = st.reveal;
  const myPos = st.pos[uid] ?? START;
  const dests = canPick ? exitsFor(map, myPos, st.dice) : [];
  const seen = seenBy(st, uid);
  const stood = new Set(st.stood[uid] ?? []);
  const cell = cellPx;
  const gridW = SIZE * cell + (SIZE - 1) * DOOR;
  const gridH = gridW;

  const pick = (to: number) => {
    if (!canPick) return;
    setChoice(to);
    const key = `${st.rev}:${to}`;
    if (sent.current === key) return;
    sent.current = key;
    api
      .sendSugorokuMove(room.code, { matchId: room.matchId, roundNo: room.roundNo }, { rev: st.rev, to })
      .catch((e) => {
        sent.current = '';
        console.warn('pick failed', e);
      });
  };

  // What the reveal says: what happened to me, and what everybody can see.
  const revealLines = (): string[] => {
    if (!rev) return [];
    const lines: string[] = [];
    const mine = rev.steps.find((x) => x.uid === uid);
    if (mine) {
      const pts = Math.abs(mine.delta);
      if (mine.outcome === 'exit') lines.push('You step into the portal!');
      else if (mine.outcome === 'illusion') lines.push('It was an illusion! You are thrown back.');
      else if (mine.outcome === 'locked') lines.push('The door is locked and will not give… yet.');
      else if (mine.effect === 'bonus') lines.push(`A chamber of bounty: +${pts} Survival Points.`);
      else if (mine.effect === 'danger') lines.push(`A chamber of peril: −${pts} Survival Points.`);
      else if (mine.effect === 'recovery') lines.push(`A chamber of renewal: +${pts} Survival Points.`);
      else if (mine.outcome === 'moved') lines.push('You move to the next chamber.');
      else lines.push('You stay in the chamber.');
    }
    for (const id of rev.escaped) if (id !== uid) lines.push(`${name(id)} reached the portal!`);
    for (const id of rev.out) lines.push(id === uid ? 'You run out of Survival Points.' : `${name(id)} runs out of Survival Points.`);
    return lines;
  };

  const overText = () => {
    if (st.winners.length === 0) return 'Nobody escaped the labyrinth.';
    if (st.winners.length === 1) {
      const w = st.winners[0];
      return `${who(w)} ${w === uid ? 'escape' : 'escapes'} through the portal!`;
    }
    return `${st.winners.map(who).join(' and ')} escape together. A shared victory!`;
  };

  // ------------------------------------------------------------ board ----
  // (plain functions, not components: a component made inside this one would be rebuilt on every
  // 100 ms redraw of the countdown and lose the player's tap)
  const renderDoor = (a: number, b: number) => {
    const no = map.door[doorKey(a, b)];
    const known = stood.has(a) || stood.has(b) || !alive;
    const lit = canPick && (a === myPos || b === myPos) && no === st.dice;
    if (!known) return <View style={styles.doorUnknown} />;
    return (
      <View style={[styles.door, lit && styles.doorLit]}>
        <Text style={[styles.doorText, lit && { color: c.portal }]}>{no}</Text>
      </View>
    );
  };

  const renderRoom = (id: number) => {
    const visible = seen.has(id) || !alive; // the portal is hidden like any other chamber
    const here = id === myPos;
    const target = dests.includes(id);
    const chosen = choice === id;
    const kind = visible ? shownKind(map, st, id) : 'plain';
    const opened = kind === 'locked' && st.unlocked.includes(id);
    const tint = TINT[kind];
    return (
      <Pressable
        onPress={() => pick(id)}
        disabled={!target}
        accessibilityRole="button"
        accessibilityLabel={`Chamber ${id + 1}`}
        style={({ pressed }) => [
          styles.room,
          { width: cell, height: cell },
          !visible && styles.roomFog,
          visible && { borderColor: tint },
          kind === 'exit' && styles.roomPortal,
          here && styles.roomHere,
          target && styles.roomTarget,
          chosen && styles.roomChosen,
          pressed && target && { opacity: 0.7 },
        ]}
      >
        {visible && (
          <Text style={[styles.glyph, { color: tint, fontSize: kind === 'exit' ? cell * 0.62 : cell * 0.42 }]}>
            {opened ? '▢' : GLYPH[kind]}
          </Text>
        )}
        {!visible && <Text style={styles.fogMark}>·</Text>}
      </Pressable>
    );
  };

  const sp = st.sp[uid] ?? 0;
  const hint = !alive
    ? null
    : !picking
      ? null
      : rolling
        ? 'The die is rolling…'
        : dests.length > 0
        ? `Doorways marked ${st.dice} are open. Choose a chamber.`
        : `No doorway answers to ${st.dice}. You stay here.`;

  return (
    <View style={styles.root}>
      {/* The die, the turn and the clock */}
      <View style={styles.top}>
        <Die value={rolling ? rollFace : st.dice} rolling={rolling} spin={spin} />
        <View style={styles.topText}>
          <Text style={styles.turn}>
            Turn {st.turn} of {MAX_TURNS}
          </Text>
          <Text style={styles.sub}>The die shows {st.dice} for everyone</Text>
        </View>
        {picking && <Text style={[styles.timer, left < 4000 && { color: c.hot }]}>{secondsLeft(left)}s</Text>}
      </View>

      {/* Survival Points */}
      <View style={styles.spBox}>
        <Text style={styles.spLabel}>Survival Points</Text>
        <View style={styles.spBar}>
          <View style={[styles.spFill, { width: `${Math.min(100, (sp / START_POINTS) * 100)}%` }, sp <= 4 && { backgroundColor: c.hot }]} />
        </View>
        <Text style={[styles.spNum, sp <= 4 && { color: c.hot }]}>{sp}</Text>
      </View>

      {/* The players */}
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
                {won ? 'FREE' : out ? 'OUT' : ready ? '✔' : picking ? '…' : `${st.sp[id] ?? 0}`}
              </Text>
            </View>
          );
        })}
      </View>

      {/* The labyrinth */}
      <View style={styles.board} onLayout={(e) => setBoardW(e.nativeEvent.layout.width)}>
        <View style={{ width: gridW, height: gridH }}>
        {Array.from({ length: SIZE }, (_, r) => (
          <React.Fragment key={r}>
            <View style={styles.line}>
              {Array.from({ length: SIZE }, (_, col) => {
                const id = r * SIZE + col;
                return (
                  <React.Fragment key={col}>
                    {renderRoom(id)}
                    {col < SIZE - 1 && (
                      <View style={{ width: DOOR, alignItems: 'center' }}>
                        {renderDoor(id, id + 1)}
                      </View>
                    )}
                  </React.Fragment>
                );
              })}
            </View>
            {r < SIZE - 1 && (
              <View style={[styles.line, { height: DOOR }]}>
                {Array.from({ length: SIZE }, (_, col) => {
                  const id = r * SIZE + col;
                  return (
                    <React.Fragment key={col}>
                      <View style={{ width: cell, alignItems: 'center' }}>
                        {renderDoor(id, id + SIZE)}
                      </View>
                      {col < SIZE - 1 && <View style={{ width: DOOR }} />}
                    </React.Fragment>
                  );
                })}
              </View>
            )}
          </React.Fragment>
        ))}
        {/* the markers, gliding over the chambers */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {st.order.map((p) => {
            const tv = tokens.current[p];
            const there = st.pos[p];
            if (!tv || !st.alive.includes(p)) return null;
            if (alive && p !== uid && there !== myPos && !neighbors(myPos).includes(there)) return null; // out of sight
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

      {alive && picking && hint && <Text style={styles.hint}>{hint}</Text>}
      {canPick && dests.length > 0 && (
        <Pressable
          onPress={() => pick(myPos)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.stay, choice === myPos && styles.stayChosen, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.stayText, choice === myPos && { color: c.void1 }]}>Stay in this chamber</Text>
        </Pressable>
      )}

      {st.phase === 'reveal' && rev && (
        <View style={styles.reveal}>
          {revealLines().map((line, i) => (
            <Text key={i} style={[styles.revealLine, i === 0 && { color: c.bone, fontWeight: '800' }]}>
              {line}
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

// A chamber edge: the top-left catches the starlight, the bottom-right is in shadow.
const edge = (light: string, dark: string) => ({
  borderTopColor: light,
  borderLeftColor: light,
  borderBottomColor: dark,
  borderRightColor: dark,
});
const flat = (col: string) => edge(col, col);

const styles = StyleSheet.create({
  root: { gap: 12 },
  waiting: { alignItems: 'center', gap: 6, paddingVertical: 30 },
  waitingTitle: { color: c.bone, fontFamily: FONT_SUGOROKU, fontSize: 18, fontWeight: '700' },
  waitingText: { color: c.boneMuted, fontFamily: FONT_SUGOROKU, fontSize: 15 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  topText: { flex: 1, gap: 2 },
  turn: { color: c.bone, fontFamily: FONT_SUGOROKU, fontSize: 18, fontWeight: '800' },
  sub: { color: c.boneMuted, fontFamily: FONT_SUGOROKU, fontSize: 13 },
  timer: { color: c.gold, fontFamily: FONT_SUGOROKU, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  die: {
    width: 62,
    height: 62,
    borderRadius: 12,
    backgroundColor: c.tablet,
    borderWidth: 3,
    borderColor: c.portal,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 5,
  },
  dieRolling: { borderColor: c.gold },
  pipCell: { width: '33.33%', height: '33.33%', alignItems: 'center', justifyContent: 'center' },
  pip: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.portal },
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
  line: { flexDirection: 'row', alignItems: 'center' },
  room: {
    borderRadius: 8,
    backgroundColor: c.stone,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomFog: { backgroundColor: c.fog, borderColor: c.stoneLo },
  roomPortal: { backgroundColor: '#12304A', borderWidth: 3 },
  roomHere: { backgroundColor: '#3A3170', ...flat(c.gold), borderWidth: 3 },
  roomTarget: { backgroundColor: '#17415A', ...flat(c.portal), borderWidth: 3 },
  roomChosen: { backgroundColor: c.gold, ...flat(c.goldSoft) },
  glyph: { fontWeight: '900' },
  fogMark: { color: c.rune, fontSize: 18, opacity: 0.5 },
  token: { position: 'absolute', left: -TOKEN / 2, top: -TOKEN / 2, width: TOKEN, height: TOKEN, borderRadius: TOKEN / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.void1 },
  tokenMe: { borderWidth: 2, borderColor: c.bone },
  tokenText: { color: c.void1, fontSize: 10, fontWeight: '900' },
  door: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: c.panel,
    borderWidth: 1.5,
    borderColor: c.rune,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorLit: { backgroundColor: 'rgba(125,243,228,0.22)', borderColor: c.portal, borderWidth: 2 },
  doorText: { color: c.boneMuted, fontSize: 10, fontWeight: '800', lineHeight: 12 },
  doorUnknown: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.rune, opacity: 0.4 },
  hint: { color: c.portal, fontFamily: FONT_SUGOROKU, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  stay: {
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: c.gold,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
    backgroundColor: c.panel,
  },
  stayChosen: { backgroundColor: c.gold },
  stayText: { color: c.gold, fontFamily: FONT_SUGOROKU, fontSize: 15, fontWeight: '700' },
  note: { color: c.goldSoft, fontFamily: FONT_SUGOROKU, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  reveal: { backgroundColor: c.panel, borderWidth: 2, borderColor: c.portalViolet, borderRadius: 10, padding: 14, gap: 6 },
  revealLine: { color: c.boneMuted, fontFamily: FONT_SUGOROKU, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  over: { backgroundColor: c.panel, borderWidth: 2, borderColor: c.portal, borderRadius: 10, padding: 18 },
  overText: { color: c.portal, fontFamily: FONT_SUGOROKU, fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 30 },
});