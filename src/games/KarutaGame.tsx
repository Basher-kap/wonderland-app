import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  apply,
  KarutaEvent,
  newGame,
  publicState,
  remainingNow,
  shuffleOrder,
  State,
  tick,
  withAdvance,
} from '../game/karuta';
import * as api from '../lib/api';
import { colors, radius } from '../theme';
import type { GameProps } from './types';

// Karuta: 26 letter cards are dealt equally; the leftover cards are void. A floating target card
// appears after a random time (within 15 s) and everybody races to take it from any rack. A wrong
// card is a penalty (you receive it); a correct card taken from somebody else's rack lets you send
// one of your own cards to them. The first player with an empty rack clears the game.
//
// All the rules live in src/game/karuta.ts. The HOST's phone is the only one that runs the game:
// it applies everybody's moves (saved in lobbies/{code}/karuta) and saves the state (without the
// secret advance grabs), which every phone shows. If the host forfeits the game the others cannot
// continue (known limit, same as Battleships and Fortune). The forfeit buttons are GameScreen's.
//
// Layout (hidden notes, not in the rules window): the screen is one board. Every OTHER player's
// rack is a collapsible tab on the left or right edge (alternating, so many players fit); MY rack is
// the only one that stays open, pinned to the bottom of the screen for the whole game. The floating
// target card appears anywhere on the board except the bottom (so it never covers my rack). While
// memorizing all racks are open; every time a new target starts to count down, the racks that were
// open collapse again (players can open them again).

const PLAYER_COLORS = ['#EF9F27', '#5DCAA5', '#AFA9EC', '#F09595', '#7DB8F0', '#E8D44D', '#C792EA', '#8BD17C'];

const secondsLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000));
const pct = (n: number): `${number}%` => `${n * 100}%`;

// A letter card. Defined outside KarutaGame on purpose: the board re-renders several times a second,
// and a component created inside would be remounted every time (taps would be lost).
function Card({ letter, small, tint, onPress, disabled, marked, glow }: {
  letter: string;
  small?: boolean;
  tint?: string;
  onPress?: () => void;
  disabled?: boolean;
  marked?: boolean;
  glow?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={`Card ${letter}`}
      style={({ pressed }) => [
        styles.card,
        small ? styles.cardSmall : styles.cardBig,
        tint ? { borderBottomColor: tint, borderBottomWidth: 4 } : null,
        marked && styles.cardMarked,
        glow && styles.cardGlow,
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.cardLetter, small ? { fontSize: 20 } : { fontSize: 28 }]}>{letter}</Text>
    </Pressable>
  );
}

export function KarutaGame({ seed, uid, onFinish, room }: GameProps) {
  const [st, setSt] = useState<State | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({}); // which other racks are expanded
  const [pick, setPick] = useState<{ no: number; owner: string; card: string } | null>(null); // my grab for the current target
  const [, setFrame] = useState(0); // re-render a few times per second for the countdowns
  const receivedAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const sent = useRef('');
  const finished = useRef(false);
  const bob = useRef(new Animated.Value(0)).current;
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
        .writeKarutaState(r.code, round, s.ver, JSON.stringify(withClock(s)))
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

    const unsubscribe = api.subscribeKaruta(
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
        // HOST: start the game (or carry on from the saved one, putting the secret advance grabs
        // back from the grab moves), then apply the new moves.
        if (!h.state) {
          if (docState) {
            h.state = withAdvance(docState, moves);
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

    // HOST: the timers (memorize, the wait for the target, the target, the card being sent) and
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

  // The target floats up and down a little.
  useEffect(() => {
    const native = Platform.OS !== 'web';
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -7, duration: 800, useNativeDriver: native }),
        Animated.timing(bob, { toValue: 7, duration: 800, useNativeDriver: native }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  // Racks: all open while memorizing; every time a new target starts, the racks collapse again.
  const openKey = st ? (st.phase === 'memorize' ? 'memorize' : `t${st.targetNo}`) : '';
  useEffect(() => {
    if (!st || !openKey) return;
    setOpen(openKey === 'memorize' ? Object.fromEntries(st.order.map((id) => [id, true])) : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey]);

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

  const send = (kind: 'grab' | 'give', extra: { owner?: string; card?: string }) => {
    const r = roomRef.current;
    if (!r || !st) return;
    const key = `${kind}:${st.targetNo}`;
    if (sent.current === key) return;
    sent.current = key;
    api
      .sendKarutaMove(r.code, { matchId: r.matchId, roundNo: r.roundNo }, { rev: st.targetNo, kind, ...extra })
      .catch((e) => {
        sent.current = '';
        if (kind === 'grab') setPick(null);
        console.warn('move failed', e);
      });
  };

  if (!room) {
    return (
      <View style={styles.waiting}>
        <Text style={styles.waitingTitle}>Karuta needs other players</Text>
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
  const poss = (id: string) => (id === uid ? 'your' : `${name(id)}’s`);
  const colorOf = (id: string) => PLAYER_COLORS[Math.max(0, st.order.indexOf(id)) % PLAYER_COLORS.length];
  const left = remainingNow(st, receivedAt.current, Date.now());
  const inGame = st.order.includes(uid) && !st.out.includes(uid);
  const others = st.order.filter((id) => id !== uid);
  const sending = st.phase === 'giving' && st.giver === uid && inGame;
  const myGrabUsed = st.tried.includes(uid) || st.advanced.includes(uid);
  // My grab for THIS target only: `pick` keeps the last one, so it must be compared with the target number.
  const myPick = pick && pick.no === st.targetNo ? pick : null;
  const canGrab = inGame && (st.phase === 'waiting' || st.phase === 'live') && !myGrabUsed && !myPick;

  const grab = (owner: string, card: string) => {
    if (!canGrab) return;
    setPick({ no: st.targetNo, owner, card });
    send('grab', { owner, card });
  };
  const give = (card: string) => {
    if (!sending) return;
    send('give', { card });
  };

  const eventText = (e: KarutaEvent): string => {
    const w = who(e.by);
    switch (e.kind) {
      case 'took': {
        const from = e.owner === e.by ? (e.by === uid ? 'your own' : 'their own') : poss(e.owner as string);
        return `${w} took ${e.card} from ${from} rack${e.advance ? ' (in advance)' : ''}`;
      }
      case 'wrong':
        return e.own
          ? `${w} grabbed the wrong card (${e.card})`
          : `${w} grabbed the wrong card and received ${e.card} from ${poss(e.owner as string)} rack`;
      case 'gave':
        return `${w} sent ${e.card} to ${e.owner === uid ? 'you' : name(e.owner as string)}${e.auto ? ' (out of time)' : ''}`;
      case 'nobody':
        return 'Nobody took the card in time';
      case 'forfeit':
        return `${w} left the game`;
    }
  };

  const status =
    st.phase === 'memorize'
      ? `Memorize the racks · ${secondsLeft(left)}s`
      : st.phase === 'waiting'
        ? myGrabUsed
          ? 'Card picked. Waiting…'
          : 'Get ready…'
        : st.phase === 'live'
          ? myGrabUsed
            ? 'Card picked'
            : 'Grab it!'
          : st.phase === 'giving'
            ? sending
              ? `Send one of your cards to ${name(st.giveTo)} · ${secondsLeft(left)}s`
              : `${name(st.giver)} is sending a card to ${name(st.giveTo)}…`
            : 'Game over';

  const rackTab = (id: string) => {
    const isOpen = !!open[id];
    const out = st.out.includes(id);
    const flagged = st.phase === 'live' ? st.tried.includes(id) : st.phase === 'waiting' ? st.advanced.includes(id) : false;
    return (
      <View key={id} style={[styles.rack, isOpen && styles.rackOpen, { borderColor: colorOf(id) }, out && { opacity: 0.4 }]}>
        <Pressable
          onPress={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}
          accessibilityRole="button"
          accessibilityLabel={`${isOpen ? 'Collapse' : 'Open'} ${name(id)}'s rack`}
          style={styles.rackHead}
        >
          <Text style={[styles.rackName, { color: colorOf(id) }]} numberOfLines={1}>
            {flagged ? '✋ ' : ''}
            {name(id)}
          </Text>
          <Text style={styles.rackCount}>{out ? 'OUT' : st.racks[id].length}</Text>
        </Pressable>
        {isOpen && !out && (
          <View style={styles.rackCards}>
            {st.racks[id].map((c) => (
              <Card
                key={c}
                letter={c}
                small
                onPress={() => grab(id, c)}
                disabled={!canGrab}
                marked={myPick?.owner === id && myPick.card === c}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  // Other players alternate between the left and the right edge.
  const leftIds = others.filter((_, i) => i % 2 === 0);
  const rightIds = others.filter((_, i) => i % 2 === 1);
  const column = (ids: string[], side: 'left' | 'right') => {
    const anyOpen = ids.some((id) => open[id] && !st.out.includes(id));
    return (
      <ScrollView
        style={[styles.column, side === 'left' ? { left: 0 } : { right: 0 }, { width: anyOpen ? 142 : 84 }]}
        contentContainerStyle={{ gap: 6, alignItems: side === 'left' ? 'flex-start' : 'flex-end' }}
        showsVerticalScrollIndicator={false}
      >
        {ids.map(rackTab)}
      </ScrollView>
    );
  };

  const recent = st.events.slice(-2);
  const myCards = st.racks[uid] ?? [];

  return (
    <View style={styles.root}>
      {/* Status */}
      <View style={styles.top}>
        <Text style={[styles.status, sending && { color: colors.accent }]}>{status}</Text>
      </View>

      {/* The board: side racks, the floating target, the latest events */}
      <View style={styles.board}>
        <View style={styles.events} pointerEvents="none">
          {recent.map((e) => (
            <Text key={e.n} style={styles.eventLine}>
              {eventText(e)}
            </Text>
          ))}
        </View>

        {st.phase === 'over' && (
          <View style={styles.over} pointerEvents="none">
            <Text style={styles.overText}>
              {st.winner ? `${who(st.winner)} cleared the game!` : 'Nobody wins: it is a tie.'}
            </Text>
          </View>
        )}

        {column(leftIds, 'left')}
        {column(rightIds, 'right')}

        {st.phase === 'live' && st.target && st.spot && (
          <Animated.View
            pointerEvents="none"
            style={[styles.floating, { left: pct(st.spot.x), top: pct(st.spot.y), transform: [{ translateY: bob }] }]}
          >
            <Text style={styles.floatingLetter}>{st.target}</Text>
          </Animated.View>
        )}
      </View>

      {/* My rack: always open, at the bottom */}
      <View style={[styles.mine, { borderColor: colorOf(uid) }, sending && { borderColor: colors.accent }]}>
        <View style={styles.mineHead}>
          <Text style={[styles.rackName, { color: colorOf(uid) }]}>You · {inGame ? myCards.length : 'out'}</Text>
          {inGame && st.phase !== 'over' && (st.phase === 'waiting' || st.phase === 'live') && myGrabUsed && (
            <Text style={styles.rackCount}>✋ picked</Text>
          )}
        </View>
        {inGame ? (
          <View style={styles.mineCards}>
            {myCards.map((c) => (
              <Card
                key={c}
                letter={c}
                tint={colorOf(uid)}
                onPress={sending ? () => give(c) : () => grab(uid, c)}
                disabled={sending ? false : !canGrab}
                marked={myPick?.owner === uid && myPick.card === c}
                glow={sending}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.note}>You left the game. Watching…</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  waiting: { alignItems: 'center', gap: 6, paddingVertical: 30 },
  waitingTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  waitingText: { color: colors.muted, fontSize: 15 },
  top: { paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' },
  status: { color: colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  board: { flex: 1, position: 'relative', overflow: 'hidden' },
  events: { position: 'absolute', top: 6, left: 0, right: 0, alignItems: 'center', gap: 2, paddingHorizontal: 90 },
  eventLine: { color: colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  over: { position: 'absolute', left: 90, right: 90, top: '38%', alignItems: 'center', zIndex: 5 },
  overText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    backgroundColor: colors.card,
    borderColor: colors.chance,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    overflow: 'hidden',
  },
  column: { position: 'absolute', top: 0, bottom: 0, flexGrow: 0 },
  rack: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 4,
    gap: 4,
    maxWidth: 140,
  },
  rackOpen: { backgroundColor: colors.cardAlt },
  rackHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingHorizontal: 4, paddingVertical: 4 },
  rackName: { fontSize: 12, fontWeight: '800', flexShrink: 1 },
  rackCount: { color: colors.text, fontSize: 12, fontWeight: '800' },
  rackCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, width: 132 },
  card: {
    backgroundColor: colors.text,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D9C9A8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSmall: { width: 38, height: 50 },
  cardBig: { width: 46, height: 62 },
  cardMarked: { borderColor: colors.accent, borderWidth: 3 },
  cardGlow: { borderColor: colors.accent, borderWidth: 3 },
  cardLetter: { color: colors.bg, fontWeight: '900' },
  floating: {
    position: 'absolute',
    width: 84,
    height: 112,
    marginLeft: -42,
    backgroundColor: colors.text,
    borderColor: colors.accent,
    borderWidth: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 10,
  },
  floatingLetter: { color: colors.bg, fontSize: 56, fontWeight: '900' },
  mine: {
    backgroundColor: colors.card,
    borderTopWidth: 2,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 6,
    maxHeight: '40%',
  },
  mineHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mineCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  note: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});