import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { TatamiBackground } from '../components/TatamiBackground';
import { FONT_KARUTA, washitsu as w } from '../gameThemes/karutaTheme';
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
// LOOK: a traditional room at the end of a summer day (src/gameThemes/karutaTheme.ts). The open doors, the
// wind chime, the tatami floor and the rules dialogs are in components/TatamiBackground.tsx and
// gameThemes/gameThemes.tsx. This screen draws its own background because GameScreen gives a full-screen game
// the whole screen.
//
// Layout (hidden notes, not in the rules window): top to bottom: the status line, the target card
// slot (FIXED at the top, the target always appears in the same place), the latest events, then the
// other players' racks stacked vertically (each rack is a collapsible row that extends from the left
// or the right edge, alternating; its cards are in ONE horizontal line), and MY rack, the only one
// that stays open, in one single line fitting the screen width, pinned to the bottom. While
// memorizing all racks are open; every time a new target starts to count down, the racks that were
// open collapse again (players can open them again).

const PLAYER_COLORS = ['#EF9F27', '#5DCAA5', '#AFA9EC', '#F09595', '#7DB8F0', '#E8D44D', '#C792EA', '#8BD17C'];

const secondsLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000));

// A letter card of a given width (the height follows). Defined outside KarutaGame on purpose: the
// board re-renders several times a second, and a component created inside would be remounted every
// time (taps would be lost).
function Card({ letter, width, tint, onPress, disabled, marked, glow }: {
  letter: string;
  width: number;
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
        { width, height: Math.round(width * 1.35) },
        tint ? { borderBottomColor: tint, borderBottomWidth: 3 } : null,
        marked && styles.cardMarked,
        glow && styles.cardGlow,
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.cardLetter, { fontSize: Math.max(8, Math.round(width * 0.55)) }]}>{letter}</Text>
    </Pressable>
  );
}

// Width of each card so that `count` cards fit in one line of `avail` pixels (never wider than `max`).
const fitWidth = (avail: number, count: number, gap: number, max: number) =>
  Math.max(8, Math.min(max, Math.floor((avail - gap * Math.max(0, count - 1)) / Math.max(1, count))));

export function KarutaGame({ seed, uid, onFinish, room }: GameProps) {
  const [st, setSt] = useState<State | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({}); // which other racks are expanded
  const [pick, setPick] = useState<{ no: number; owner: string; card: string } | null>(null); // my grab for the current target
  const [, setFrame] = useState(0); // re-render a few times per second for the countdowns
  const receivedAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const sent = useRef('');
  const finished = useRef(false);
  const { width: screenW } = useWindowDimensions();
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
      <TatamiBackground>
        <View style={styles.waiting}>
          <Text style={styles.waitingTitle}>Karuta needs other players</Text>
          <Text style={styles.waitingText}>Create or join a lobby to play it.</Text>
        </View>
      </TatamiBackground>
    );
  }
  if (!st) {
    return (
      <TatamiBackground>
        <View style={styles.waiting}>
          <Text style={styles.waitingText}>Getting the game ready…</Text>
        </View>
      </TatamiBackground>
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
      case 'auto':
        return `Nobody took ${e.card} in time: it was taken from ${e.by === uid ? 'your' : `${name(e.by)}’s`} rack`;
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

  // Other players' racks: one row each, stacked vertically. The name tab sits on the left or the right
  // edge (alternating) and the cards are in one horizontal line next to it.
  const TAB_W = 78;
  const rackRow = (id: string, i: number) => {
    const isOpen = !!open[id];
    const out = st.out.includes(id);
    const onLeft = i % 2 === 0;
    const flagged = st.phase === 'live' ? st.tried.includes(id) : st.phase === 'waiting' ? st.advanced.includes(id) : false;
    const cards = st.racks[id];
    const w = fitWidth(screenW - 12 - TAB_W - 14, cards.length, 3, 34);
    return (
      <View
        key={id}
        style={[
          styles.rack,
          { flexDirection: onLeft ? 'row' : 'row-reverse', alignSelf: onLeft ? 'flex-start' : 'flex-end', borderColor: colorOf(id) },
          isOpen && !out && styles.rackOpen,
          out && { opacity: 0.4 },
        ]}
      >
        <Pressable
          onPress={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}
          accessibilityRole="button"
          accessibilityLabel={`${isOpen ? 'Collapse' : 'Open'} ${name(id)}'s rack`}
          style={[styles.rackTab, { width: TAB_W }]}
        >
          <Text style={[styles.rackName, { color: colorOf(id) }]} numberOfLines={1}>
            {flagged ? '✋ ' : ''}
            {name(id)}
          </Text>
          <Text style={styles.rackCount}>{out ? 'OUT' : cards.length}</Text>
        </Pressable>
        {isOpen && !out && (
          <View style={[styles.rackCards, { justifyContent: onLeft ? 'flex-start' : 'flex-end' }]}>
            {cards.map((c) => (
              <Card
                key={c}
                letter={c}
                width={w}
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

  const recent = st.events.slice(-2);
  const myCards = st.racks[uid] ?? [];
  const myW = fitWidth(screenW - 20, myCards.length, 3, 46);

  return (
    <TatamiBackground>
    <View style={styles.root}>
      {/* Status */}
      <View style={styles.top}>
        <Text style={[styles.status, sending && { color: w.vermilion }]}>{status}</Text>
      </View>

      {/* The target card: always in the same place, at the top */}
      <View style={styles.targetSlot}>
        {st.phase === 'live' && st.target ? (
          <View style={styles.target}>
            <Text style={styles.targetLetter}>{st.target}</Text>
          </View>
        ) : (
          <View style={[styles.target, styles.targetEmpty]}>
            <Text style={[styles.targetLetter, { color: w.paper }]}>?</Text>
          </View>
        )}
      </View>

      {/* The latest events */}
      <View style={[styles.events, recent.length > 0 && styles.eventsPlate]}>
        {recent.map((e) => (
          <Text key={e.n} style={styles.eventLine} numberOfLines={2}>
            {eventText(e)}
          </Text>
        ))}
      </View>

      {/* The other players' racks */}
      <View style={styles.board}>
        <ScrollView contentContainerStyle={styles.racks} showsVerticalScrollIndicator={false}>
          {others.map(rackRow)}
        </ScrollView>
        {st.phase === 'over' && (
          <View style={styles.over} pointerEvents="none">
            <Text style={styles.overText}>
              {st.winner ? `${who(st.winner)} cleared the game!` : 'Nobody wins: it is a tie.'}
            </Text>
          </View>
        )}
      </View>

      {/* My rack: always open, in one line, at the bottom */}
      <View style={[styles.mine, { borderColor: colorOf(uid) }, sending && { borderColor: w.gold }]}>
        <View style={styles.mineHead}>
          <Text style={[styles.rackName, { color: colorOf(uid) }]}>You · {inGame ? myCards.length : 'out'}</Text>
          {inGame && (st.phase === 'waiting' || st.phase === 'live') && myGrabUsed && (
            <Text style={styles.rackCount}>✋ picked</Text>
          )}
        </View>
        {inGame ? (
          <View style={styles.mineCards}>
            {myCards.map((c) => (
              <Card
                key={c}
                letter={c}
                width={myW}
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
    </TatamiBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  waiting: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 80,
    paddingVertical: 18,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(246,240,224,0.94)',
    borderColor: w.wood,
    borderWidth: 3,
    borderRadius: 6,
  },
  waitingTitle: { color: w.ink, fontFamily: FONT_KARUTA, fontSize: 18, fontWeight: '700' },
  waitingText: { color: w.ink, fontFamily: FONT_KARUTA, fontSize: 15 },
  top: { paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' },
  status: {
    color: w.ink,
    fontFamily: FONT_KARUTA,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    backgroundColor: 'rgba(246,240,224,0.94)',
    borderColor: w.wood,
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  targetSlot: { alignItems: 'center', paddingVertical: 4 },
  target: {
    width: 84,
    height: 112,
    backgroundColor: w.paper,
    borderColor: w.vermilion,
    borderWidth: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  targetEmpty: { backgroundColor: 'rgba(246,240,224,0.15)', borderColor: w.paper, borderStyle: 'dashed', shadowOpacity: 0, elevation: 0 },
  targetLetter: { color: w.indigo, fontFamily: FONT_KARUTA, fontSize: 56, fontWeight: '900' },
  events: { minHeight: 34, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 12 },
  eventsPlate: {
    alignSelf: 'center',
    marginHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(246,240,224,0.9)',
  },
  eventLine: { color: w.ink, fontFamily: FONT_KARUTA, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  board: { flex: 1, position: 'relative' },
  racks: { padding: 6, gap: 6 },
  over: { position: 'absolute', left: 20, right: 20, top: '30%', alignItems: 'center', zIndex: 5 },
  overText: {
    color: w.ink,
    fontFamily: FONT_KARUTA,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    backgroundColor: w.paper,
    borderColor: w.vermilion,
    borderWidth: 3,
    borderRadius: 8,
    padding: 12,
    overflow: 'hidden',
  },
  rack: {
    alignItems: 'center',
    backgroundColor: w.tray,
    borderWidth: 2,
    borderRadius: 8,
    padding: 4,
    gap: 6,
  },
  rackOpen: { backgroundColor: w.woodLight },
  rackTab: { paddingHorizontal: 4, paddingVertical: 4, gap: 2 },
  rackName: { fontFamily: FONT_KARUTA, fontSize: 12, fontWeight: '800' },
  rackCount: { color: w.paper, fontFamily: FONT_KARUTA, fontSize: 12, fontWeight: '800' },
  rackCards: { flex: 1, flexDirection: 'row', flexWrap: 'nowrap', gap: 3 },
  card: {
    backgroundColor: w.paper,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: w.paperEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMarked: { borderColor: w.vermilion, borderWidth: 3 },
  cardGlow: { borderColor: w.gold, borderWidth: 3 },
  cardLetter: { color: w.indigo, fontFamily: FONT_KARUTA, fontWeight: '900' },
  mine: {
    backgroundColor: w.wood,
    borderTopWidth: 3,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 6,
  },
  mineHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mineCards: { flexDirection: 'row', flexWrap: 'nowrap', gap: 3 },
  note: { color: w.paper, fontFamily: FONT_KARUTA, fontSize: 13, textAlign: 'center' },
});
