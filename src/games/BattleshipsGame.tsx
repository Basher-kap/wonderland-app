import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
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
import { AWNING_H, Ballista, Mark, Stone, Trireme, displayWeight, FONT_DISPLAY, roma } from '../gameThemes/battleships';
import type { MarkOutcome } from '../gameThemes/battleships';
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

// What is left on a shot tile (drawn in gameThemes/battleships/NaumachiaArt.tsx): a splash = a miss, fire = you
// hit an enemy ship, a skull = you sank your own ship, a mushroom cloud = you sacrificed your ship
// to sink an enemy's.
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const MIC_SPACE = 128; // the lobby's mic pill floats in the top-right corner (VoiceButton): keep clear
const AXIS = 16; // the width of the row letters
const GAP = 4;
const FRAME = 9; // the stone frame round the sea (padding + border)
const CAPTION_H = 62;

const secondsLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000));

export function BattleshipsGame({ seed, uid, onFinish, room }: GameProps) {
  const [st, setSt] = useState<State | null>(null);
  const [sel, setSel] = useState<number[]>([]); // my ships while placing
  const [ready, setReady] = useState(false); // I pressed Ready (my placement was sent)
  const [area, setArea] = useState({ w: 0, h: 0 }); // the space the sea may take
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
        <View style={styles.tablet}>
          <Text style={styles.title}>Battleships needs other players</Text>
          <Text style={styles.sub}>Create or join a lobby to play it.</Text>
        </View>
      </View>
    );
  }
  if (!st) {
    return (
      <View style={styles.waiting}>
        <View style={styles.tablet}>
          <Text style={styles.title}>Getting the game ready…</Text>
        </View>
      </View>
    );
  }

  const name = (id: string | null) => (id ? room.usernames[id] ?? 'A player' : 'Nobody');
  const who = (id: string) => (id === uid ? 'You' : name(id));
  const colorOf = (id: string) => roma.players[Math.max(0, st.order.indexOf(id)) % roma.players.length];
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

  // "Ken’s" / "your" (when I am the one who was hit).
  const poss = (id: string) => (id === uid ? 'your' : `${name(id)}’s`);
  const list = (items: string[]) =>
    items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

  const shotLine = (s: Shot): string => {
    const w = who(s.by);
    const byMe = s.by === uid;
    const victims = `${list(s.victims.map(poss))} ${s.victims.length === 1 ? 'battleship' : 'battleships'}`;
    const lines: string[] = [];
    switch (s.outcome) {
      case 'miss':
        lines.push(`${w} missed`);
        break;
      case 'hit':
        lines.push(`${w} hit ${victims}`);
        break;
      case 'own':
        lines.push(`${w} sank ${byMe ? 'your' : 'his'} own battleship`);
        break;
      case 'neutral':
        lines.push(`${w} sacrificed ${byMe ? 'your' : 'his'} battleship to sink ${victims}`);
        break;
      case 'timeout':
        lines.push(`${w} ran out of time`);
        break;
    }
    for (const id of s.out) lines.push(`${who(id)} ${id === uid ? 'have' : 'has'} no battleships left and ${id === uid ? 'are' : 'is'} out!`);
    return lines.join('\n');
  };

  const markOf = (cell: number): MarkOutcome | null => {
    const sh = shotAt.get(cell);
    return sh ? (sh.outcome as MarkOutcome) : null;
  };

  const winnerLine =
    st.winner
      ? [`${name(st.winner)} wins!`, `with ${st.shipsLeft[st.winner]} battleship${st.shipsLeft[st.winner] === 1 ? '' : 's'} left`]
      : afloatNone(st)
        ? ['Nobody wins', 'Nobody has a battleship left.']
        : ['Nobody wins', 'It is a tie.'];
  const title =
    st.phase === 'placing'
      ? locked
        ? 'Ships placed. Waiting for the others…'
        : `Place your ${SHIP_COUNT} battleships`
      : st.phase === 'countdown'
        ? 'Battle start!'
        : st.phase === 'over'
          ? winnerLine[0]
          : mine
            ? 'Your turn: pick a cell to shoot'
            : `${name(st.current)} is aiming…`;
  const timerLine =
    st.phase === 'placing'
      ? `${secondsLeft(left)}s · ${sel.length}/${SHIP_COUNT} placed`
      : st.phase === 'countdown'
        ? `${Math.max(1, secondsLeft(left))}`
        : st.phase === 'aiming'
          ? `${secondsLeft(left)}s of ${secondsLeft(TURN_MS)}s${mine ? ' · too slow loses a bullet' : ''}`
          : st.phase === 'over'
            ? winnerLine[1]
            : '';
  const urgent = left < 4000 && (st.phase === 'placing' || st.phase === 'aiming');
  const subLine = !inGame && st.phase !== 'over' && st.phase !== 'placing' ? 'You are out. Watching the game…' : timerLine;

  // ---- sizes: everything is worked out from the space the screen gives us -----------------------
  const onArea = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea((a) => (a.w === width && a.h === height ? a : { w: width, h: height }));
  };
  const n = st.order.length;
  const cols = n <= 2 ? Math.max(1, n) : n <= 4 ? 2 : 4;
  const chipW = Math.floor((area.w - 24 - 6 * (cols - 1)) / cols);
  const availW = Math.min(area.w - 24, 400);
  const cellS = Math.max(
    26,
    Math.floor(Math.min((availW - FRAME * 2 - AXIS - GAP * (GRID - 1)) / GRID, (area.h - FRAME * 2 - 18 - GAP * GRID) / GRID, 66))
  );
  const frameW = FRAME * 2 + AXIS + cellS * GRID + GAP * (GRID - 1);

  const lastLines = lastShot && st.phase !== 'placing' ? shotLine(lastShot) : '';
  const notes = [
    st.out.length > 0 && st.phase !== 'over' ? `${st.out.map(name).join(', ')} left the game.` : '',
  ].filter(Boolean);
  const caption = [lastLines, ...notes].filter(Boolean).join('\n');

  return (
    <View style={[styles.root, { paddingTop: AWNING_H + 6 }]}>
      {/* what is happening, and the clock */}
      <View style={[styles.tablet, styles.statusRow, { marginRight: MIC_SPACE }]}>
        <View style={{ opacity: mine ? 1 : 0.5 }}>
          <Ballista size={38} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
            {title}
          </Text>
          {subLine !== '' && (
            <Text style={[styles.sub, urgent && { color: roma.blood }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {subLine}
            </Text>
          )}
        </View>
      </View>

      {/* the players: ships and stones left */}
      <View style={styles.players}>
        {st.order.map((id) => {
          const out = st.shipsLeft[id] === 0;
          return (
            <View
              key={id}
              style={[
                styles.player,
                { width: chipW, borderLeftColor: colorOf(id) },
                id === st.current && st.phase === 'aiming' && !out && styles.playerOnTheClock,
                out && { opacity: 0.45 },
              ]}
            >
              <Text style={styles.playerName} numberOfLines={1}>
                {room.usernames[id] ?? 'A player'}
                {id === uid ? ' (you)' : ''}
              </Text>
              {out ? (
                <Text style={styles.playerOut}>Out</Text>
              ) : (
                <View style={styles.playerStats}>
                  <Trireme size={18} />
                  <Text style={styles.playerCount}>{st.shipsLeft[id]}</Text>
                  <View style={styles.stones}>
                    {Array.from({ length: BULLETS }, (_, i) => (
                      <Stone key={i} size={10} spent={i >= st.bullets[id]} />
                    ))}
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* the sea: a mosaic of water tiles in a stone frame */}
      <View style={styles.seaArea} onLayout={onArea}>
        {area.w > 0 && (
          <View style={[styles.frame, { width: frameW }]}>
            <View style={styles.axisRow}>
              <View style={{ width: AXIS }} />
              {ROMAN.map((r) => (
                <Text key={r} style={[styles.axis, { width: cellS }]}>
                  {r}
                </Text>
              ))}
            </View>
            <View style={styles.sea}>
              {Array.from({ length: GRID }, (_, r) => (
                <View key={r} style={styles.gridRow}>
                  <Text style={[styles.axis, { width: AXIS }]}>{String.fromCharCode(65 + r)}</Text>
                  {Array.from({ length: GRID }, (_, c) => {
                    const cell = r * GRID + c;
                    const shot = shotAt.get(cell);
                    const mark = markOf(cell);
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
                          styles.tile,
                          { width: cellS, height: cellS },
                          shot && { borderColor: colorOf(shot.by), borderWidth: 2 },
                          placedHere && styles.tileShip,
                          placedHere && !placing && { opacity: 0.5 },
                          canShoot && styles.tileAim,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        {!shot && !placedHere && (
                          <>
                            <View style={[styles.wave, { top: cellS * 0.36, left: cellS * 0.2, width: cellS * 0.34 }]} />
                            <View style={[styles.wave, { top: cellS * 0.58, left: cellS * 0.42, width: cellS * 0.34 }]} />
                          </>
                        )}
                        {placedHere && <Trireme size={cellS * 0.82} />}
                        {mark && <Mark outcome={mark} size={cellS * 0.74} />}
                        {shot && (
                          <View style={[styles.badge, { backgroundColor: colorOf(shot.by) }]}>
                            <Text style={styles.badgeText}>{name(shot.by).slice(0, 1).toUpperCase()}</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* below the sea: the Ready button while placing, otherwise the last shot, told for everybody */}
      <View style={[styles.bottom, { height: CAPTION_H }]}>
        {placing && !locked ? (
          <Pressable
            onPress={confirm}
            disabled={sel.length !== SHIP_COUNT}
            accessibilityRole="button"
            style={[styles.button, sel.length !== SHIP_COUNT && { opacity: 0.45 }]}
          >
            <Text style={styles.buttonText}>{sel.length === SHIP_COUNT ? 'Ready' : `Place ${SHIP_COUNT - sel.length} more`}</Text>
          </Pressable>
        ) : caption !== '' ? (
          <View style={styles.reveal}>
            {lastShot && lastShot.outcome !== 'timeout' && st.phase !== 'placing' && <Mark outcome={lastShot.outcome as MarkOutcome} size={34} />}
            <Text style={styles.revealLine} numberOfLines={4} adjustsFontSizeToFit minimumFontScale={0.75}>
              {caption}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const afloatNone = (s: State) => s.order.every((id) => s.shipsLeft[id] === 0);

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 12, paddingBottom: 8, gap: 6 },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  tablet: {
    backgroundColor: roma.parchment,
    borderWidth: 2,
    borderColor: roma.parchmentEdge,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50 },
  title: { color: roma.ink, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 14 },
  sub: { color: roma.bronze, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 12.5, marginTop: 1 },

  players: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  player: {
    minHeight: 44,
    backgroundColor: roma.plaque,
    borderWidth: 1,
    borderColor: roma.plaqueEdge,
    borderLeftWidth: 4,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    justifyContent: 'center',
    gap: 2,
  },
  playerOnTheClock: { borderColor: roma.gold, borderWidth: 2 },
  playerName: { color: roma.cream, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 12 },
  playerStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  playerCount: { color: roma.cream, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 13 },
  stones: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  playerOut: { color: roma.cream, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 13 },

  seaArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    padding: FRAME - 3,
    borderWidth: 3,
    borderColor: roma.bronze,
    borderRadius: 10,
    backgroundColor: roma.parchmentEdge,
  },
  axisRow: { flexDirection: 'row', gap: GAP, marginBottom: 2 },
  axis: { color: roma.ink, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 12, textAlign: 'center' },
  sea: { gap: GAP, backgroundColor: roma.grout, borderRadius: 6, padding: 0 },
  gridRow: { flexDirection: 'row', gap: GAP, alignItems: 'center' },
  tile: {
    backgroundColor: roma.tile,
    borderWidth: 1.5,
    borderColor: roma.tileEdge,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileShip: { backgroundColor: roma.tile, borderColor: roma.gold, borderWidth: 2 },
  tileAim: { borderColor: roma.gold, borderWidth: 2, backgroundColor: '#3A8F88' },
  wave: { position: 'absolute', height: 2, borderRadius: 1, backgroundColor: 'rgba(232,244,242,0.28)' },
  badge: { position: 'absolute', top: 1, right: 1, width: 15, height: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: roma.ink, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 9 },

  bottom: { justifyContent: 'center' },
  button: { backgroundColor: roma.gold, borderWidth: 2, borderColor: roma.bronze, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: roma.ink, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 16 },
  reveal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: roma.plaque,
    borderWidth: 1,
    borderColor: roma.plaqueEdge,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  revealLine: { flex: 1, color: roma.cream, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 13 },
});
