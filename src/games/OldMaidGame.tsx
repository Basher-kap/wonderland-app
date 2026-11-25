import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import {
  apply,
  aliveOf,
  Event,
  isAlive,
  MIN_PLAYERS,
  newGame,
  publicState,
  rankOf,
  remainingNow,
  seatOffset,
  sortHand,
  State,
  tick,
  withHands,
} from '../game/oldMaid';
import * as omApi from '../lib/oldMaidApi';
import type { OldMaidHandDoc, OldMaidSnapshot } from '../lib/oldMaidApi';
import { Bench, Bunting, CARD_RATIO, CardBack, PlayingCard, ZapBolt } from '../gameThemes/oldMaid/OldMaidArt';
import { displayWeight, FONT_DISPLAY, plaza } from '../gameThemes/oldMaid/theme';
import type { GameProps } from './types';

// Old Maid (Alice in Borderland): 4 or more players, seven cards each, matching pairs thrown away. On your
// turn you draw one card from the player on your right (the next one counterclockwise). Whoever has the
// Joker taken from them, runs out of cards, or leaves their seat is electrocuted through the wire of their
// chair. The last player alive, holding the Joker, clears the game.
//
// All the rules are in src/game/oldMaid.ts. Like Battleships the HOST's phone runs the game (players write
// moves, the host applies them and saves the shared state). Unlike Battleships the hands are secret: the host
// saves each player's hand in a document only that player can read (lib/oldMaidApi.ts), and the shared state
// holds only how many cards everybody has. The forfeit buttons are GameScreen's.
//
// Hidden notes kept here on purpose, not in the rules window: nobody sees a hand but their own; the player
// you draw from shuffles their hand before every draw; 15 seconds to draw, then a random card is drawn for
// you.

const MIC_SPACE = 128; // the lobby's mic pill floats in the top-right corner (VoiceButton): keep clear
const SEAT_W = 84;
const SEAT_H = 74;

const secondsLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000));
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

type Hand = { v: number; cards: string[] } | null;

export function OldMaidGame({ seed, uid, onFinish, room }: GameProps) {
  const [st, setSt] = useState<State | null>(null);
  const [handDoc, setHandDoc] = useState<Hand>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [, setFrame] = useState(0); // re-render a few times per second for the countdowns
  const [picked, setPicked] = useState<number | null>(null);
  const receivedAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const sent = useRef('');
  const finished = useRef(false);
  const roomRef = useRef(room);
  roomRef.current = room;
  const host = useRef<{
    state: State | null;
    pending: State | null;
    writing: boolean;
    handsVersion: number;
    starting: boolean;
    snap: OldMaidSnapshot | null;
  }>({ state: null, pending: null, writing: false, handsVersion: -1, starting: false, snap: null });

  useEffect(() => {
    const r = roomRef.current;
    if (!r || r.playerIds.length < MIN_PLAYERS) return;
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

    // HOST: save the hands (when any changed), then the state. One write at a time; only the newest matters.
    const flush = () => {
      if (h.writing || !h.pending) return;
      const s = h.pending;
      h.pending = null;
      h.writing = true;
      const hands = s.hv !== h.handsVersion ? omApi.writeOldMaidHands(r.code, round, s.hv, s.hands) : Promise.resolve();
      hands
        .then(() => {
          h.handsVersion = s.hv;
          return omApi.writeOldMaidState(r.code, round, s.ver, JSON.stringify(withClock(s)));
        })
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

    // HOST: apply the new moves to the running game.
    const runMoves = () => {
      const snap = h.snap;
      if (!snap || !h.state) return;
      const moves = snap.moves
        .filter((m) => m.matchId === round.matchId && m.roundNo === round.roundNo)
        .sort((a, b) => a.at - b.at);
      let s = h.state;
      for (const m of moves) s = apply(s, { uid: m.uid, rev: m.rev, kind: 'draw', index: m.index }, Date.now());
      if (s !== h.state) hostSet(s);
    };

    const unsubscribe = omApi.subscribeOldMaid(
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
        h.snap = snap;
        if (!h.state) {
          if (h.starting) return;
          if (docState) {
            // The host's phone was restarted: carry on from the saved state, hands read back.
            h.starting = true;
            omApi
              .readOldMaidHands(r.code, docState.order)
              .then((docs: Record<string, OldMaidHandDoc>) => {
                const hands: Record<string, string[]> = {};
                for (const id of Object.keys(docs)) hands[id] = docs[id].cards;
                h.handsVersion = docState!.hv;
                h.state = withHands(docState!, hands);
                show(docState!);
                runMoves();
              })
              .catch((e: unknown) => console.warn('reading the hands failed', e))
              .finally(() => {
                h.starting = false;
              });
          } else {
            hostSet(newGame(r.playerIds.slice().sort(() => 0), seed, Date.now()));
          }
          return;
        }
        runMoves();
      },
      (e) => console.warn('game listener failed', e)
    );

    // Everybody: my own hand.
    const unsubscribeHand = omApi.subscribeMyOldMaidHand(
      r.code,
      uid,
      (doc) => {
        if (doc && doc.matchId === round.matchId && doc.roundNo === round.roundNo) setHandDoc({ v: doc.v, cards: doc.cards });
      },
      (e) => console.warn('hand listener failed', e)
    );

    // HOST: the timers (the deal, 15 seconds to draw, the result banner) and players who forfeited.
    const timer = r.isHost
      ? setInterval(() => {
          if (!h.state) return;
          const next = tick(h.state, Date.now(), roomRef.current?.out ?? []);
          if (next !== h.state) hostSet(next);
        }, 200)
      : null;

    return () => {
      unsubscribe();
      unsubscribeHand();
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
    }, 4500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.phase, st?.winner]);

  // A new turn: nothing is picked yet.
  useEffect(() => {
    setPicked(null);
  }, [st?.rev]);

  const draw = (index: number) => {
    const r = roomRef.current;
    if (!r || !st) return;
    const key = `draw:${st.rev}`;
    if (sent.current === key) return;
    sent.current = key;
    setPicked(index);
    omApi.sendOldMaidMove(r.code, { matchId: r.matchId, roundNo: r.roundNo }, { rev: st.rev, index }).catch((e: unknown) => {
      sent.current = '';
      setPicked(null);
      console.warn('move failed', e);
    });
  };

  if (!room) {
    return (
      <View style={styles.waiting}>
        <View style={styles.panel}>
          <Text style={styles.title}>Old Maid needs other players</Text>
          <Text style={styles.sub}>Create or join a lobby to play it.</Text>
        </View>
      </View>
    );
  }
  if (room.playerIds.length < MIN_PLAYERS) {
    return (
      <View style={styles.waiting}>
        <View style={styles.panel}>
          <Text style={styles.title}>Old Maid needs {MIN_PLAYERS} players</Text>
          <Text style={styles.sub}>Only {room.playerIds.length} are in this lobby.</Text>
        </View>
      </View>
    );
  }
  if (!st) {
    return (
      <View style={styles.waiting}>
        <View style={styles.panel}>
          <Text style={styles.title}>Shuffling the cards…</Text>
        </View>
      </View>
    );
  }

  const name = (id: string | null) => (id ? room.usernames[id] ?? 'A player' : 'Nobody');
  const who = (id: string) => (id === uid ? 'You' : name(id));
  const left = remainingNow(st, receivedAt.current, Date.now());
  const alive = isAlive(st, uid);
  const myTurn = st.phase === 'turn' && st.current === uid && alive;
  const iAmTarget = st.phase === 'turn' && st.target === uid && alive;
  const myHand = room.isHost ? host.current.state?.hands[uid] ?? [] : handDoc?.cards ?? [];
  const shownHand = alive ? sortHand(myHand) : [];
  const targetCount = st.target ? st.counts[st.target] ?? 0 : 0;
  const n = st.order.length;
  const lastOut = st.last && st.phase !== 'turn' ? st.last.out.map((o) => o.uid) : [];
  const zapNow = (id: string) => lastOut.includes(id) && Math.floor(Date.now() / 160) % 2 === 0;

  const eventLine = (e: Event): string => {
    const lines: string[] = [];
    if (e.kind === 'left') {
      lines.push(`${who(e.drawer ?? '')} left the seat.`);
    } else {
      lines.push(`${who(e.drawer ?? '')} drew a card from ${e.target === uid ? 'you' : name(e.target)}.`);
      if (e.joker) lines.push('IT WAS THE OLD MAID!');
      else if (e.pair) lines.push(`A pair of ${rankOf(e.pair[0])}s is thrown away.`);
      if (e.auto) lines.push('(Too slow: a random card.)');
    }
    for (const o of e.out) {
      const why = o.why === 'joker' ? 'was left with the Old Maid' : o.why === 'empty' ? 'ran out of cards' : 'left their seat';
      lines.push(`${who(o.uid)} ${why}: electrocuted.`);
    }
    return lines.join(' ');
  };

  let banner = '';
  if (st.phase === 'dealing') banner = `Seven cards each. Matching pairs are thrown away… ${secondsLeft(left)}`;
  else if (st.phase === 'turn') {
    const who1 = st.current === uid ? 'Your turn' : `${name(st.current)}'s turn`;
    banner = myTurn
      ? `Your turn: draw a card from ${name(st.target)}. ${secondsLeft(left)}s`
      : iAmTarget
        ? `${name(st.current)} is drawing from you. ${secondsLeft(left)}s`
        : `${who1}: drawing from ${name(st.target)}. ${secondsLeft(left)}s`;
  } else if (st.last) banner = eventLine(st.last);
  if (st.phase === 'over') banner = st.winner === uid ? 'You hold the Old Maid. You survived!' : `${name(st.winner)} survived holding the Old Maid.`;

  // seats on an ellipse, me at the bottom, the player on my right next, going counterclockwise
  const rx = Math.max(60, area.w / 2 - SEAT_W / 2 - 4);
  const ry = Math.max(50, area.h / 2 - SEAT_H / 2 - 4);
  const seatPos = (id: string) => {
    const a = Math.PI / 2 - (2 * Math.PI * seatOffset(st, uid, id)) / n;
    return { left: area.w / 2 + rx * Math.cos(a) - SEAT_W / 2, top: area.h / 2 + ry * Math.sin(a) - SEAT_H / 2 };
  };

  // cards in a row, overlapping when they would not fit
  const rowWidth = Math.max(0, area.w - 24);
  const rowLayout = (count: number, maxW: number) => {
    const w = Math.min(maxW, Math.max(30, rowWidth / Math.max(1, count) - 2));
    const step = count > 1 ? Math.min(w + 6, (rowWidth - w) / (count - 1)) : 0;
    return { w, step, total: count > 0 ? w + step * (count - 1) : 0 };
  };
  const handRow = rowLayout(shownHand.length, 58);
  const trayRow = rowLayout(targetCount, 50);
  const lastPair = st.discards.length > 0 ? st.discards[st.discards.length - 1].cards : null;
  const myOutWhy = st.out[uid];

  return (
    <View style={styles.root}>
      <View style={styles.bunting} pointerEvents="none">
        <Bunting width={Math.max(300, area.w || 360)} />
      </View>

      <View style={[styles.bannerWrap, { paddingRight: MIC_SPACE }]}>
        <View style={[styles.banner, st.phase === 'result' && st.last && st.last.out.length > 0 && styles.bannerZap]}>
          <Text style={[styles.bannerText, st.phase === 'result' && st.last && st.last.out.length > 0 && { color: plaza.onDark }]}>{banner}</Text>
        </View>
      </View>

      <View style={styles.table} onLayout={(e: LayoutChangeEvent) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {area.w > 0 &&
          st.order.map((id) => {
            const out = id in st.out;
            const pos = seatPos(id);
            const isCur = st.phase === 'turn' && st.current === id;
            const isTarget = st.phase === 'turn' && st.target === id;
            const count = st.counts[id] ?? 0;
            return (
              <View key={id} style={[styles.seat, pos, out && { opacity: 0.55 }]}>
                <View style={[styles.avatar, isCur && styles.avatarCur, isTarget && styles.avatarTarget]}>
                  <Text style={styles.avatarText}>{(name(id)[0] ?? '?').toUpperCase()}</Text>
                  {zapNow(id) && (
                    <View style={styles.zap}>
                      <ZapBolt size={46} />
                    </View>
                  )}
                </View>
                <Text numberOfLines={1} style={styles.seatName}>
                  {id === uid ? 'You' : name(id)}
                </Text>
                <Text style={styles.seatSub}>
                  {out ? 'OUT' : isCur ? 'drawing' : isTarget ? 'being drawn' : `${count} ${plural(count, 'card', 'cards')}`}
                </Text>
                <View style={styles.bench}>
                  <Bench width={SEAT_W - 20} lit={isCur || zapNow(id)} />
                </View>
              </View>
            );
          })}

        {/* the middle of the plaza: the thrown-away pairs */}
        <View style={styles.middle} pointerEvents="none">
          {lastPair ? (
            <View style={styles.pairRow}>
              <PlayingCard card={lastPair[0]} width={34} />
              <View style={{ marginLeft: -12, marginTop: 4 }}>
                <PlayingCard card={lastPair[1]} width={34} />
              </View>
            </View>
          ) : (
            <CardBack width={34} />
          )}
          <Text style={styles.middleText}>
            {st.discards.length} {plural(st.discards.length, 'pair', 'pairs')} out
          </Text>
        </View>
      </View>

      {/* the tray: on my turn the cards of the player on my right, face down; tap one to draw it */}
      <View style={[styles.tray, { height: trayRow.w * CARD_RATIO + 8 }]}>
        {myTurn && targetCount > 0 ? (
          <View style={{ width: trayRow.total, height: trayRow.w * CARD_RATIO }}>
            {Array.from({ length: targetCount }, (_, i) => (
              <Pressable
                key={i}
                onPress={() => draw(i)}
                disabled={picked !== null}
                accessibilityLabel={`Draw card ${i + 1} of ${targetCount}`}
                style={{ position: 'absolute', left: i * trayRow.step, top: picked === i ? -8 : 0, zIndex: i }}
              >
                <CardBack width={trayRow.w} selected={picked === i} dim={picked !== null && picked !== i} />
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.trayHint}>
            {st.phase === 'over'
              ? ''
              : !alive
                ? myOutWhy === 'joker'
                  ? 'The Old Maid was drawn from you. You are out.'
                  : myOutWhy === 'empty'
                    ? 'You ran out of cards. You are out.'
                    : 'You left your seat. You are out.'
                : st.phase === 'turn'
                  ? 'Wait for your turn…'
                  : ''}
          </Text>
        )}
      </View>

      {/* my hand */}
      <View style={styles.hand}>
        {alive ? (
          <View style={{ width: handRow.total, height: handRow.w * CARD_RATIO }}>
            {shownHand.map((c, i) => (
              <View key={`${c}${i}`} style={{ position: 'absolute', left: i * handRow.step, zIndex: i }}>
                <PlayingCard card={c} width={handRow.w} />
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.trayHint}>You can watch the others play.</Text>
        )}
      </View>

      {st.phase === 'over' && (
        <View style={styles.overlay} pointerEvents="none">
          <View style={[styles.panel, { borderColor: st.winner === uid ? plaza.good : plaza.warn }]}>
            <Text style={[styles.overTitle, { color: st.winner === uid ? plaza.good : plaza.warn }]}>
              {st.winner === uid ? 'GAME CLEAR' : 'GAME OVER'}
            </Text>
            <Text style={styles.sub}>{aliveOf(st).length > 0 ? `${name(st.winner)} survived with the Old Maid.` : 'Nobody survived.'}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bunting: { position: 'absolute', top: 0, left: 0, right: 0, height: 34 },
  bannerWrap: { paddingTop: 30, paddingLeft: 12, paddingBottom: 4 },
  banner: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,246,226,0.94)',
    borderWidth: 2,
    borderColor: plaza.gold,
  },
  bannerZap: { backgroundColor: plaza.warn, borderColor: plaza.wire },
  bannerText: { color: plaza.ink, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 14, lineHeight: 18 },
  table: { flex: 1, margin: 4 },
  seat: { position: 'absolute', width: SEAT_W, height: SEAT_H, alignItems: 'center' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: plaza.tileBlue,
    borderWidth: 3,
    borderColor: plaza.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCur: { borderColor: plaza.pick, backgroundColor: plaza.terracotta },
  avatarTarget: { borderColor: plaza.petalPink },
  avatarText: { color: plaza.onDark, fontWeight: '900', fontSize: 17 },
  zap: { position: 'absolute', top: -4, left: -4 },
  seatName: { color: plaza.ink, fontWeight: '800', fontSize: 12, maxWidth: SEAT_W, backgroundColor: 'rgba(255,246,226,0.85)', paddingHorizontal: 5, borderRadius: 6, marginTop: 1 },
  seatSub: { color: plaza.inkSoft, fontSize: 10, fontWeight: '700', backgroundColor: 'rgba(255,246,226,0.7)', paddingHorizontal: 4, borderRadius: 5 },
  bench: { marginTop: 1 },
  middle: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pairRow: { flexDirection: 'row' },
  middleText: { marginTop: 4, color: plaza.ink, fontSize: 11, fontWeight: '800', backgroundColor: 'rgba(255,246,226,0.85)', paddingHorizontal: 6, borderRadius: 6 },
  tray: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  trayHint: { color: plaza.ink, fontWeight: '800', fontSize: 13, textAlign: 'center', backgroundColor: 'rgba(255,246,226,0.85)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  hand: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingBottom: 10, minHeight: 90 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,246,226,0.35)' },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  panel: { backgroundColor: plaza.paper, borderColor: plaza.gold, borderWidth: 3, borderRadius: 14, padding: 18, alignItems: 'center', maxWidth: 340 },
  title: { color: plaza.title, fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 20, textAlign: 'center' },
  overTitle: { fontFamily: FONT_DISPLAY, fontWeight: displayWeight, fontSize: 32, letterSpacing: 2 },
  sub: { color: plaza.inkSoft, marginTop: 6, fontSize: 14, textAlign: 'center' },
});
