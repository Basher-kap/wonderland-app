import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  apply,
  fmt,
  LOSE_AT,
  MAX_NUMBER,
  newGame,
  publicState,
  remainingNow,
  RULE_TEXT,
  rulesFor,
  shuffleOrder,
  State,
  tick,
} from '../game/beautyContest';
import type { Reveal, RuleId } from '../game/beautyContest';
import * as api from '../lib/api';
import { royal as c, FONT_ROYAL } from '../gameThemes/beautyContest';
import type { GameProps } from './types';

// Beauty Contest: everybody secretly picks a number from 0 to 100; the average x 0.8 is the
// target and the closest wins the round, everybody else loses a point; at -10 you are out. The
// last one left wins. Special rules join when 4, 3 and 2 players are left.
//
// All the rules live in src/game/beautyContest.ts. The HOST's phone is the only one that runs the
// game: it applies everybody's locked numbers (saved in lobbies/{code}/beauty) and saves the state,
// which every phone shows; the numbers are not in the saved state until the reveal. The other
// phones only show the state and send numbers. If the host forfeits the game, the others cannot
// continue (known limit, same as Fortune and Xibalba). The forfeit buttons are GameScreen's.
//
// LOOK: the Royal Court (src/gameThemes/beautyContest/). The players stand in a circle around
// the judgment throne; their numbers stay hidden until the time is up. The throne shows the
// average and the target at the reveal.
//
// Hidden notes kept here on purpose, not on the game screen: the special rules are shown only once
// they are in force (announced in the reveal that introduces them), and the list of them lives in
// game/beautyContest.ts.

const NODE_MAX = 74;
const KEYS: (number | 'back' | 'lock')[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  ['back', 0, 'lock'],
];

const secondsLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000));
const points = (n: number) => `${n === 1 ? '1 point' : `${n} points`}`;

export function BeautyContestGame({ seed, uid, onFinish, room }: GameProps) {
  const [st, setSt] = useState<State | null>(null);
  const [draft, setDraft] = useState('');
  const [lockedVal, setLockedVal] = useState<number | null>(null);
  const [boardW, setBoardW] = useState(320);
  const [, setFrame] = useState(0); // re-render a few times per second for the countdown
  const receivedAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const sent = useRef(''); // the number already sent for this round
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
        .writeBeautyState(r.code, round, s.ver, JSON.stringify(withClock(s)))
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

    const unsubscribe = api.subscribeBeauty(
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
        // HOST: start the game (or carry on from the saved state), then apply the new numbers.
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
        for (const m of moves) s = apply(s, { uid: m.uid, rev: m.rev, value: m.value, at: m.at });
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

  // A new round (or phase): nothing is typed or locked yet.
  useEffect(() => {
    setDraft('');
    setLockedVal(null);
    sent.current = '';
  }, [st?.rev]);

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

  if (!room) {
    return (
      <View style={styles.waiting}>
        <Text style={styles.waitingTitle}>Beauty Contest needs other players</Text>
        <Text style={styles.waitingText}>Create or join a lobby to play it.</Text>
      </View>
    );
  }
  if (!st) {
    return (
      <View style={styles.waiting}>
        <Text style={styles.waitingText}>The court is assembling…</Text>
      </View>
    );
  }

  const name = (id: string) => room.usernames[id] ?? 'A player';
  const who = (id: string) => (id === uid ? 'You' : name(id));
  const left = remainingNow(st, receivedAt.current, Date.now());
  const alive = st.alive.includes(uid);
  const picking = st.phase === 'pick';
  const canPick = picking && alive;
  const rev = st.reveal;
  const rules = rulesFor(st.alive.length);

  const typeKey = (k: number | 'back' | 'lock') => {
    if (!canPick) return;
    if (k === 'back') {
      setDraft((d) => d.slice(0, -1));
    } else if (k === 'lock') {
      if (draft === '') return;
      const value = Number(draft);
      setLockedVal(value);
      const key = `${st.rev}:${value}`;
      if (sent.current === key) return;
      sent.current = key;
      api
        .sendBeautyMove(room.code, { matchId: room.matchId, roundNo: room.roundNo }, { rev: st.rev, value })
        .catch((e) => {
          sent.current = '';
          setLockedVal(null);
          console.warn('locking in failed', e);
        });
    } else {
      setDraft((d) => {
        const next = d === '0' ? String(k) : d + String(k);
        return Number(next) > MAX_NUMBER ? d : next;
      });
    }
  };

  // What the reveal says, step by step, ending with the new rules.
  const verdictLines = (v: Reveal): string[] => {
    const lines: string[] = [];
    if (v.target === null) {
      lines.push('Nobody chose a number. Everyone loses a point.');
    } else {
      const t = fmt(v.target);
      if (v.reason === 'extremes') lines.push(`${who(v.winners[0])} chose 100 against 0 and win${v.winners[0] === uid ? '' : 's'} the round.`);
      else if (v.reason === 'exact') {
        const names = v.winners.map(who).join(' and ');
        lines.push(`${names} chose exactly ${t}${v.penalty === 2 ? '! Everyone else loses two points.' : '.'}`);
      } else if (v.reason === 'tie') lines.push(`${v.winners.map(who).join(' and ')} are equally close to ${t} and all win the round.`);
      else if (v.reason === 'closest') {
        const w = v.winners[0];
        const val = v.rows.find((r) => r.uid === w)?.value;
        lines.push(`${who(w)} chose ${val}, the closest to ${t}.`);
      } else lines.push('Every number was invalid. Everyone loses a point.');
    }
    const invalid = v.rows.filter((r) => r.status === 'invalid');
    if (invalid.length) lines.push(`${invalid.map((r) => who(r.uid)).join(', ')}: the same number was chosen twice, so it is invalid.`);
    const none = v.rows.filter((r) => r.status === 'none');
    if (none.length && v.target !== null) lines.push(`${none.map((r) => who(r.uid)).join(', ')} did not choose in time.`);
    if (v.winners.length && v.penalty === 1) lines.push('Everyone else loses a point.');
    for (const id of v.out) lines.push(id === uid ? `GAME OVER for you: ${LOSE_AT} points.` : `GAME OVER for ${name(id)}: ${LOSE_AT} points.`);
    return lines;
  };

  const overText = () => {
    if (!st.winner) return 'Nobody wins this judgment.';
    return st.winner === uid ? 'You win the game!' : `${name(st.winner)} wins the game!`;
  };

  // ----------------------------------------------------------- circle ----
  const node = Math.min(NODE_MAX, Math.floor(boardW * 0.215));
  const radius = (boardW - node) / 2 - 4;
  const center = boardW / 2;

  const renderNode = (id: string, i: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / st.order.length;
    const x = center + radius * Math.cos(angle) - node / 2;
    const y = center + radius * Math.sin(angle) - node / 2;
    const out = !st.alive.includes(id);
    const row = rev?.rows.find((r) => r.uid === id);
    const showNums = st.phase !== 'pick';
    const won = st.phase === 'reveal' && row?.status === 'won';
    const bad = st.phase === 'reveal' && row?.status === 'invalid';
    const isMe = id === uid;
    const ready = picking && st.locked.includes(id);
    let big: string;
    if (out && !(st.phase === 'reveal' && row)) big = 'OUT';
    else if (showNums) big = row?.value === null || row?.value === undefined ? '—' : String(row.value);
    else if (isMe && lockedVal !== null) big = String(lockedVal);
    else big = ready ? '✔' : '?';
    return (
      <View
        key={id}
        style={[
          styles.node,
          { left: x, top: y, width: node, height: node + 8 },
          isMe && styles.nodeMe,
          won && styles.nodeWon,
          bad && styles.nodeBad,
          out && styles.nodeOut,
        ]}
      >
        <Text style={styles.nodeName} numberOfLines={1}>
          {name(id)}
        </Text>
        <Text style={[styles.nodeBig, { fontSize: big.length > 2 ? node * 0.28 : node * 0.36 }, (ready || won) && { color: c.win }, out && { color: c.crimsonSoft }]}>
          {big}
        </Text>
        <Text style={[styles.nodePts, (st.pts[id] ?? 0) <= -7 && { color: c.crimsonSoft }]}>{st.pts[id] ?? 0}</Text>
      </View>
    );
  };

  // The judgment throne in the middle: the clock while they choose, the average and the target at
  // the reveal, the verdict at the end.
  const renderThrone = () => {
    const size = boardW * 0.46;
    return (
      <View style={[styles.throne, { width: size, height: size, left: center - size / 2, top: center - size / 2, borderRadius: size / 2 }]}>
        <Text style={styles.crown}>♛</Text>
        {picking && (
          <>
            <Text style={[styles.holoBig, left < 5000 && { color: c.hot }]}>{secondsLeft(left)}</Text>
            <Text style={styles.holoSmall}>Round {st.round}</Text>
          </>
        )}
        {st.phase === 'reveal' && rev && (
          <>
            <Text style={styles.holoSmall}>AVERAGE {rev.average === null ? '—' : fmt(rev.average)}</Text>
            <Text style={styles.holoSmall}>× 0.8</Text>
            <Text style={styles.holoSmall}>TARGET</Text>
            <Text style={styles.holoBig}>{rev.target === null ? '—' : fmt(rev.target)}</Text>
          </>
        )}
        {st.phase === 'over' && <Text style={styles.holoSmall}>JUDGMENT{'\n'}PASSED</Text>}
      </View>
    );
  };

  const ruleChip = (id: RuleId) => (
    <View key={id} style={styles.rule}>
      <Text style={styles.ruleText}>{RULE_TEXT[id]}</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Round {st.round}</Text>
        <Text style={styles.sub}>{st.alive.length} remaining</Text>
      </View>

      {/* The court: the contestants in a circle around the throne */}
      <View style={[styles.board, { height: boardW }]} onLayout={(e) => setBoardW(e.nativeEvent.layout.width)}>
        {renderThrone()}
        {st.order.map(renderNode)}
      </View>

      {rules.length > 0 && (
        <View style={styles.rules}>
          <Text style={styles.rulesTitle}>SPECIAL RULES IN FORCE</Text>
          {rules.map(ruleChip)}
        </View>
      )}

      {/* The contestant's console */}
      {canPick && (
        <View style={styles.console}>
          <View style={styles.display}>
            <Text style={styles.displayNum}>{draft === '' ? '--' : draft}</Text>
            <Text style={styles.displayHint}>
              {lockedVal !== null ? (Number(draft) === lockedVal || draft === '' ? `LOCKED IN: ${lockedVal}` : `LOCKED: ${lockedVal}. Press LOCK to change.`) : `Choose 0 to ${MAX_NUMBER}`}
            </Text>
          </View>
          <View style={styles.keys}>
            {KEYS.map((row, ri) => (
              <View key={ri} style={styles.keyRow}>
                {row.map((k) => (
                  <Pressable
                    key={String(k)}
                    onPress={() => typeKey(k)}
                    accessibilityRole="button"
                    accessibilityLabel={k === 'back' ? 'Delete' : k === 'lock' ? 'Lock in' : String(k)}
                    style={({ pressed }) => [
                      styles.key,
                      k === 'lock' && styles.keyLock,
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Text style={[styles.keyText, k === 'lock' && { color: c.marble1, fontSize: 14 }]}>
                      {k === 'back' ? '⌫' : k === 'lock' ? 'LOCK' : k}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </View>
      )}

      {!alive && st.phase !== 'over' && <Text style={styles.note}>GAME OVER for you. Watching the court…</Text>}
      {picking && alive && st.alive.length > 1 && (
        <Text style={styles.hint}>
          {st.locked.length} of {st.alive.length} have locked in
        </Text>
      )}

      {st.phase === 'reveal' && rev && (
        <View style={styles.verdict}>
          {verdictLines(rev).map((line, i) => (
            <Text key={i} style={[styles.verdictLine, i === 0 && { color: c.goldBright, fontWeight: '800' }]}>
              {line}
            </Text>
          ))}
          {rev.newRules.length > 0 && (
            <View style={styles.newRules}>
              <Text style={styles.newRulesTitle}>NEW RULE</Text>
              {rev.newRules.map((id) => (
                <Text key={id} style={styles.verdictLine}>
                  {RULE_TEXT[id]}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {st.phase === 'over' && (
        <View style={styles.over}>
          <Text style={styles.overText}>{overText()}</Text>
        </View>
      )}

      {st.lastLeft && st.phase !== 'over' && <Text style={styles.note}>{name(st.lastLeft)} left the game.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  waiting: { alignItems: 'center', gap: 6, paddingVertical: 30 },
  waitingTitle: { color: c.bone, fontFamily: FONT_ROYAL, fontSize: 18, fontWeight: '700' },
  waitingText: { color: c.boneMuted, fontFamily: FONT_ROYAL, fontSize: 15 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { color: c.goldBright, fontFamily: FONT_ROYAL, fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  sub: { color: c.boneMuted, fontFamily: FONT_ROYAL, fontSize: 14, fontWeight: '600' },
  board: { alignSelf: 'stretch', position: 'relative' },
  throne: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,24,30,0.9)',
    borderWidth: 2,
    borderColor: c.holo,
    padding: 6,
  },
  crown: { color: c.gold, fontSize: 22, lineHeight: 24 },
  holoBig: { color: c.holo, fontFamily: FONT_ROYAL, fontSize: 38, fontWeight: '900', fontVariant: ['tabular-nums'], lineHeight: 42 },
  holoSmall: { color: c.holo, fontFamily: FONT_ROYAL, fontSize: 12, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
  node: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.plate,
    borderWidth: 2,
    borderColor: c.goldDeep,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  nodeMe: { borderColor: c.gold, backgroundColor: c.plateHi },
  nodeWon: { borderColor: c.win, borderWidth: 3 },
  nodeBad: { borderColor: c.crimson, borderWidth: 3 },
  nodeOut: { opacity: 0.45, borderColor: c.vein },
  nodeName: { color: c.boneMuted, fontFamily: FONT_ROYAL, fontSize: 10, fontWeight: '700', maxWidth: '100%' },
  nodeBig: { color: c.bone, fontFamily: FONT_ROYAL, fontWeight: '900', fontVariant: ['tabular-nums'] },
  nodePts: { color: c.gold, fontFamily: FONT_ROYAL, fontSize: 11, fontWeight: '800' },
  rules: { gap: 6 },
  rulesTitle: { color: c.crimsonSoft, fontFamily: FONT_ROYAL, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  rule: { backgroundColor: c.panel, borderLeftWidth: 3, borderLeftColor: c.crimson, paddingVertical: 6, paddingHorizontal: 10 },
  ruleText: { color: c.bone, fontFamily: FONT_ROYAL, fontSize: 13, lineHeight: 18 },
  console: { gap: 10, backgroundColor: c.panel, borderWidth: 2, borderColor: c.gold, borderRadius: 6, padding: 12 },
  display: { alignItems: 'center', backgroundColor: 'rgba(8,24,30,0.9)', borderWidth: 1, borderColor: c.holo, borderRadius: 4, paddingVertical: 8 },
  displayNum: { color: c.holo, fontFamily: FONT_ROYAL, fontSize: 46, fontWeight: '900', fontVariant: ['tabular-nums'], lineHeight: 52 },
  displayHint: { color: c.boneMuted, fontFamily: FONT_ROYAL, fontSize: 12, fontWeight: '600' },
  keys: { gap: 8 },
  keyRow: { flexDirection: 'row', gap: 8 },
  key: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: c.plate, borderWidth: 2, borderColor: c.goldDeep, borderRadius: 6 },
  keyLock: { backgroundColor: c.gold, borderColor: c.goldBright },
  keyText: { color: c.bone, fontFamily: FONT_ROYAL, fontSize: 20, fontWeight: '800' },
  hint: { color: c.boneMuted, fontFamily: FONT_ROYAL, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  note: { color: c.goldBright, fontFamily: FONT_ROYAL, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  verdict: { backgroundColor: c.panel, borderWidth: 2, borderColor: c.gold, borderRadius: 6, padding: 14, gap: 6 },
  verdictLine: { color: c.bone, fontFamily: FONT_ROYAL, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  newRules: { marginTop: 6, borderTopWidth: 1, borderTopColor: c.crimson, paddingTop: 8, gap: 4 },
  newRulesTitle: { color: c.crimsonSoft, fontFamily: FONT_ROYAL, fontSize: 12, fontWeight: '900', letterSpacing: 3, textAlign: 'center' },
  over: { backgroundColor: c.panel, borderWidth: 3, borderColor: c.gold, borderRadius: 6, padding: 18 },
  overText: { color: c.goldBright, fontFamily: FONT_ROYAL, fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 30 },
});