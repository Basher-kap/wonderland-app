import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import {
  applyMoves,
  CELLS,
  clock,
  GAME_MS,
  layoutFor,
  newGame,
  NO_OWNER,
  remainingNow,
  State,
  tick,
  unclaimedOf,
} from '../game/territory';
import type { Move } from '../game/territory';
import * as api from '../lib/api';
import { useReduceMotion } from '../components/ui/useReduceMotion';
import { FONT_DISPLAY, glade as g, kingdomOf, Orb } from '../gameThemes/colorTerritory';
import type { GameProps } from './types';

// Color Territory: about 50 white circles lie on a moonlit glade. Every player is secretly given a
// kingdom (a colour) at random and taps circles to dye them. A tap claims a white circle or takes
// one from another kingdom: it belongs to whoever tapped it last. When the 2 minutes are over, the
// kingdom with the most circles wins; a tie for the top is a draw.
//
// All the rules live in src/game/territory.ts. The HOST's phone is the only one that runs the game:
// it listens to everybody's taps (saved in lobbies/{code}/territory), folds them into the board and
// saves the state, which every phone shows. The other phones only listen to the saved state and send
// taps (so they do not read every tap of everybody: that would be hundreds of reads a minute).
// If the host forfeits the game, the others cannot continue (known limit, same as Fortune and
// Xibalba). The forfeit buttons are GameScreen's.
//
// LOOK: Magical Kingdoms, the Enchanted Territory (gameThemes/colorTerritory/theme.ts). The sky, the
// orbs and the rules dialogs are in gameThemes/colorTerritory/. A tap shows at once on the player's
// own screen (PENDING_MS) while it travels to the host and back.
//
// Hidden notes kept here on purpose, not on the game screen: that a circle can be taken from another
// kingdom (the newest tap wins), that a tie is a draw, and how many circles there are.

const MIC_SPACE = 128; // the lobby's mic pill floats in the top-right corner (VoiceButton): keep clear
const PENDING_MS = 700; // my own tap shows at once, until the host's state has had time to catch up
const SAVE_GAP_MS = 300; // the host saves the board at most this often
const FRAME = 6; // the gap between the board's edge and the board area
const BOARD_ASPECT = 0.8; // width / height of the glade (the circles are laid out for it)
const MIN_ORB = 26;
const MAX_ORB = 54;

export function ColorTerritoryGame({ seed, uid, onFinish, room }: GameProps) {
  const [st, setSt] = useState<State | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 }); // the space the glade may take
  const [, setFrame] = useState(0); // re-render a few times per second for the clock
  const receivedAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const finished = useRef(false);
  const pending = useRef<Record<number, number>>({}); // cell -> when I tapped it
  const roomRef = useRef(room);
  roomRef.current = room;
  const reduce = useReduceMotion();
  const shimmer = useRef(new Animated.Value(0)).current;
  const host = useRef<{
    state: State | null;
    pending: State | null;
    moves: Move[];
    writing: boolean;
    lastWrite: number;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ state: null, pending: null, moves: [], writing: false, lastWrite: 0, timer: null });

  // The white pearls breathe, slowly (not with reduce-motion).
  useEffect(() => {
    if (reduce) {
      shimmer.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, shimmer]);

  // Subscribe to the game. The host also runs it.
  useEffect(() => {
    const r = roomRef.current;
    if (!r) return;
    const round = { matchId: r.matchId, roundNo: r.roundNo };
    const h = host.current;
    const withClock = (s: State): State => ({ ...s, remainingMs: s.endsAt ? Math.max(0, s.endsAt - Date.now()) : 0 });

    const show = (s: State) => {
      receivedAt.current = Date.now();
      setSt(s);
    };

    // Save the latest state (one write at a time, not more often than SAVE_GAP_MS; only the newest
    // state matters).
    const flush = () => {
      if (h.writing || !h.pending || h.timer) return;
      const wait = h.lastWrite + SAVE_GAP_MS - Date.now();
      if (wait > 0) {
        h.timer = setTimeout(() => {
          h.timer = null;
          flush();
        }, wait);
        return;
      }
      const s = h.pending;
      h.pending = null;
      h.writing = true;
      h.lastWrite = Date.now();
      api
        .writeTerritoryState(r.code, round, s.ver, JSON.stringify(withClock(s)))
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

    const unsubscribe = api.subscribeTerritory(
      r.code,
      r.isHost,
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
        // HOST: start the game (or carry on from the saved state), then fold in the new taps.
        if (!h.state) {
          if (docState) {
            h.state = docState;
            show(docState);
          } else {
            hostSet(newGame(r.playerIds, seed, Date.now()));
          }
        }
        h.moves = snap.moves.filter((m) => m.matchId === round.matchId && m.roundNo === round.roundNo);
        const s = applyMoves(h.state!, h.moves);
        if (s !== h.state) hostSet(s);
      },
      (e) => console.warn('game listener failed', e)
    );

    // HOST: the clock (the 5-second look at your kingdom, then the 2 minutes). The last taps are
    // folded in before the time is up, so they count.
    const timer = r.isHost
      ? setInterval(() => {
          if (!h.state) return;
          const now = Date.now();
          const next = tick(applyMoves(h.state, h.moves), now);
          if (next !== h.state) hostSet(next);
        }, 150)
      : null;

    return () => {
      unsubscribe();
      if (timer) clearInterval(timer);
      if (h.timer) clearTimeout(h.timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => f + 1), 200);
    return () => clearInterval(id);
  }, []);

  // The game is over: after a moment everybody reports. Only the winner "finished" (a draw = nobody).
  useEffect(() => {
    if (st?.phase !== 'over' || finished.current) return;
    const id = setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onFinish({ finished: st.winner === uid, totalMs: Date.now() - startedAt.current });
    }, 4500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.phase, st?.winner]);

  const spots = useMemo(() => layoutFor(seed), [seed]);

  // The glade fits the space left, never scrolls. Its circles are as big as the closest two allow.
  const boardW = Math.max(0, Math.min(area.w - FRAME * 2, (area.h - FRAME * 2) * BOARD_ASPECT));
  const boardH = boardW / BOARD_ASPECT;
  const orbSize = useMemo(() => {
    let min = Infinity;
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        const d = Math.hypot((spots[i].x - spots[j].x) * boardW, (spots[i].y - spots[j].y) * boardH);
        if (d < min) min = d;
      }
    }
    if (!isFinite(min)) return MIN_ORB;
    return Math.max(MIN_ORB, Math.min(MAX_ORB, Math.floor(min * 0.9)));
  }, [spots, boardW, boardH]);

  const stRef = useRef<State | null>(null);
  stRef.current = st;
  const tap = useRef<(cell: number) => void>(() => {});
  const handlers = useMemo(() => Array.from({ length: CELLS }, (_, i) => () => tap.current(i)), []);

  if (!room) {
    return (
      <View style={styles.waiting}>
        <Text style={styles.waitingTitle}>Color Territory needs other players</Text>
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

  const now = Date.now();
  const name = (id: string) => room.usernames[id] ?? 'A player';
  const myIdx = st.order.indexOf(uid);
  const me = myIdx >= 0 ? kingdomOf(st.slots[myIdx]) : null;
  const left = remainingNow(st, receivedAt.current, now);
  const playing = st.phase === 'play' && left > 0;

  // Who owns a circle on MY screen: my own newest tap shows at once.
  const ownerOf = (cell: number) => {
    const t = pending.current[cell];
    if (playing && t && myIdx >= 0 && now - t < PENDING_MS) return myIdx;
    return st.owners[cell];
  };

  tap.current = (cell: number) => {
    const s = stRef.current;
    if (!s || s.phase !== 'play' || myIdx < 0) return;
    if (remainingNow(s, receivedAt.current, Date.now()) <= 0) return;
    const t = pending.current[cell];
    const mineNow = (t && Date.now() - t < PENDING_MS ? myIdx : s.owners[cell]) === myIdx;
    if (mineNow) return; // already mine: nothing to do
    pending.current[cell] = Date.now();
    setFrame((f) => f + 1);
    api
      .sendTerritoryMove(room.code, { matchId: room.matchId, roundNo: room.roundNo }, { rev: s.rev, cell })
      .catch((e) => {
        delete pending.current[cell];
        console.warn('tap failed', e);
      });
  };

  const counts = st.counts;
  const best = Math.max(0, ...counts);
  const unclaimed = unclaimedOf(st);
  const cols = Math.min(Math.max(st.order.length, 1), 4);
  const chipW = area.w > 0 ? Math.floor((area.w - 24 - 6 * (cols - 1)) / cols) : 80;
  const urgent = st.phase === 'play' && left <= 10000;
  const mine = myIdx >= 0 ? counts[myIdx] : 0;

  const resultText = (() => {
    if (st.phase !== 'over') return '';
    if (!st.winner) return best === 0 ? 'Nobody claimed the glade. A draw.' : 'The kingdoms are tied. A draw.';
    return st.winner === uid ? 'Your kingdom rules the glade!' : `${name(st.winner)} rules the glade.`;
  })();

  return (
    <View style={styles.root}>
      {/* my kingdom and the clock */}
      <View style={[styles.topRow, { marginRight: MIC_SPACE }]}>
        {me && (
          <View style={styles.kingdom}>
            <View style={[styles.gem, { backgroundColor: me.color, borderColor: me.light }]}>
              <Text style={styles.gemRune}>{me.rune}</Text>
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.kingdomLabel}>Your kingdom</Text>
              <Text style={styles.kingdomName} numberOfLines={1}>
                {me.name}
              </Text>
            </View>
          </View>
        )}
        <View style={[styles.clock, urgent && styles.clockUrgent]}>
          <Text style={[styles.clockText, urgent && { color: g.hot }]} accessibilityLabel={`${clock(left)} left`}>
            {st.phase === 'over' ? '0:00' : clock(st.phase === 'ready' ? GAME_MS : left)}
          </Text>
        </View>
      </View>

      {/* the kingdoms and how many orbs each rules */}
      <View style={styles.players}>
        {st.order.map((id, i) => {
          const k = kingdomOf(st.slots[i]);
          const lead = st.phase !== 'ready' && best > 0 && counts[i] === best;
          return (
            <View key={id} style={[styles.chip, { width: chipW }, id === uid && styles.chipMe, lead && styles.chipLead]}>
              <View style={[styles.chipGem, { backgroundColor: k.color, borderColor: k.light }]}>
                <Text style={styles.chipRune}>{k.rune}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.chipName} numberOfLines={1}>
                  {id === uid ? 'You' : name(id)}
                </Text>
              </View>
              <Text style={styles.chipCount}>{counts[i]}</Text>
            </View>
          );
        })}
      </View>

      {/* who holds how much of the glade */}
      <View style={styles.share} accessible accessibilityLabel={`${unclaimed} circles unclaimed`}>
        {st.order.map((id, i) =>
          counts[i] > 0 ? <View key={id} style={{ flex: counts[i], backgroundColor: kingdomOf(st.slots[i]).color }} /> : null
        )}
        {unclaimed > 0 && <View style={{ flex: unclaimed, backgroundColor: g.pearlShade, opacity: 0.35 }} />}
      </View>

      {/* the glade */}
      <View style={styles.boardArea} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {area.w > 0 && boardW > 0 && (
          <View style={[styles.board, { width: boardW, height: boardH }]}>
            <View pointerEvents="none" style={[styles.runeRing, { width: boardW * 0.78, height: boardW * 0.78, borderRadius: boardW }]} />
            {spots.map((p, i) => {
              const o = ownerOf(i);
              const k = o === NO_OWNER || o < 0 ? null : kingdomOf(st.slots[o]);
              return (
                <View
                  key={i}
                  style={{ position: 'absolute', left: p.x * boardW - orbSize / 2, top: p.y * boardH - orbSize / 2, width: orbSize, height: orbSize }}
                >
                  <Orb
                    size={orbSize}
                    kingdom={k}
                    mine={o === myIdx && o >= 0}
                    onPress={handlers[i]}
                    disabled={!playing}
                    still={reduce}
                    shimmer={shimmer}
                    label={k ? `Circle ${i + 1}, ${k.name}` : `Circle ${i + 1}, unclaimed`}
                  />
                </View>
              );
            })}

            {/* before the clock starts: which kingdom am I? */}
            {st.phase === 'ready' && me && (
              <View style={styles.readyVeil}>
                <View style={styles.readyCard}>
                  <Text style={styles.readyLabel}>You fight for the</Text>
                  <View style={{ marginVertical: 8 }}>
                    <Orb size={64} kingdom={me} mine={false} disabled still shimmer={shimmer} label={me.name} />
                  </View>
                  <Text style={styles.readyName}>{me.name}</Text>
                  <Text style={styles.readyCount}>{Math.max(1, Math.ceil(left / 1000))}</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* what you hold, or how it ended */}
      <View style={styles.footer}>
        {st.phase === 'over' ? (
          <Text style={styles.result}>{resultText}</Text>
        ) : (
          <Text style={styles.footText}>
            {st.phase === 'ready' ? 'Get ready…' : `You hold ${mine} ${mine === 1 ? 'orb' : 'orbs'}`}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 6, gap: 6 },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  waitingTitle: { color: g.gold, fontFamily: FONT_DISPLAY, fontWeight: '700', fontSize: 18, marginBottom: 6, textAlign: 'center' },
  waitingText: { color: g.text, fontFamily: FONT_DISPLAY, fontSize: 14, textAlign: 'center' },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 50 },
  kingdom: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: g.panel,
    borderColor: g.panelEdge,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  gem: { width: 30, height: 30, borderRadius: 30, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  gemRune: { color: '#FFFFFF', fontSize: 15, lineHeight: 17 },
  kingdomLabel: { color: g.textMuted, fontFamily: FONT_DISPLAY, fontSize: 10.5 },
  kingdomName: { color: g.text, fontFamily: FONT_DISPLAY, fontWeight: '700', fontSize: 14 },
  clock: {
    minWidth: 76,
    alignItems: 'center',
    backgroundColor: g.panel,
    borderColor: g.gold,
    borderWidth: 2,
    borderRadius: 26,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clockUrgent: { borderColor: g.hot },
  clockText: { color: g.gold, fontFamily: FONT_DISPLAY, fontWeight: '700', fontSize: 24, letterSpacing: 1 },

  players: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 34,
    backgroundColor: g.panel,
    borderColor: 'rgba(185, 168, 230, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  chipMe: { borderColor: g.panelEdge },
  chipLead: { borderColor: g.gold, borderWidth: 2 },
  chipGem: { width: 22, height: 22, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chipRune: { color: '#FFFFFF', fontSize: 11, lineHeight: 13 },
  chipName: { color: g.text, fontFamily: FONT_DISPLAY, fontSize: 11.5 },
  chipCount: { color: g.gold, fontFamily: FONT_DISPLAY, fontWeight: '700', fontSize: 16, minWidth: 18, textAlign: 'right' },

  share: { flexDirection: 'row', height: 6, borderRadius: 6, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },

  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  board: {
    backgroundColor: 'rgba(20, 11, 52, 0.55)',
    borderColor: g.panelEdge,
    borderWidth: 1.5,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runeRing: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(242, 203, 107, 0.14)' },

  readyVeil: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
    backgroundColor: 'rgba(14, 8, 36, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyCard: {
    alignItems: 'center',
    backgroundColor: g.parchment,
    borderColor: g.parchmentEdge,
    borderWidth: 3,
    borderRadius: 18,
    paddingHorizontal: 26,
    paddingVertical: 14,
  },
  readyLabel: { color: g.inkSoft, fontFamily: FONT_DISPLAY, fontSize: 13 },
  readyName: { color: g.ink, fontFamily: FONT_DISPLAY, fontWeight: '700', fontSize: 20 },
  readyCount: { color: g.goldDeep, fontFamily: FONT_DISPLAY, fontWeight: '700', fontSize: 34, marginTop: 2 },

  footer: { minHeight: 26, alignItems: 'center', justifyContent: 'center' },
  footText: { color: g.textMuted, fontFamily: FONT_DISPLAY, fontSize: 13 },
  result: { color: g.gold, fontFamily: FONT_DISPLAY, fontWeight: '700', fontSize: 16, textAlign: 'center' },
});
