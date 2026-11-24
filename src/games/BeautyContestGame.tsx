import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  apply,
  MAX_NUMBER,
  newGame,
  publicState,
  remainingNow,
  rulesFor,
  shuffleOrder,
  State,
  tick,
} from '../game/beautyContest';
import type { RuleId } from '../game/beautyContest';
import { buildTimeline } from '../game/beautyReveal';
import * as api from '../lib/api';
import { useReduceMotion } from '../components/ui/useReduceMotion';
import { royal as c, FONT_ROYAL } from '../gameThemes/beautyContest';
import { LockedWait, NumbersStage, OverStage, PickPad, RuleBanner, ScoresStage, SpectatorWait } from './BeautyContestStages';
import type { PadKey } from './BeautyContestStages';
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
// SCREENS (src/games/BeautyContestStages.tsx), one at a time instead of everything at once:
//   1. the number pad (it goes away after LOCK; the special rules in force are a banner under it)
//   2. the contestants with their numbers, the calculation bit by bit, the winner of the round
//   3. the contestants again with the points they lost; game over and the new special rule
// then the pad comes back for the next round. Their timing is game/beautyReveal.ts.
// LOOK: the Royal Court (src/gameThemes/beautyContest/).
//
// Hidden notes kept here on purpose, not on the game screen: the special rules are shown only once
// they are in force (announced in the reveal that introduces them), and the list of them lives in
// game/beautyContest.ts.

const secondsLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000));

export function BeautyContestGame({ seed, uid, onFinish, room }: GameProps) {
  const [st, setSt] = useState<State | null>(null);
  const [draft, setDraft] = useState('');
  const [lockedVal, setLockedVal] = useState<number | null>(null);
  const [editing, setEditing] = useState(false); // the pad is open again after LOCK ("Change my number")
  const [freshRules, setFreshRules] = useState<RuleId[]>([]); // rules that start in this round
  const seenRules = useRef<Set<RuleId> | null>(null);
  const reduce = useReduceMotion();
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
    setEditing(false);
    sent.current = '';
  }, [st?.rev]);

  // The special rules in force are a banner under the number pad; one that starts in THIS round
  // (after a player was eliminated) is marked NEW. The first state we see is not "new".
  useEffect(() => {
    if (!st || st.phase !== 'pick') return;
    const now = rulesFor(st.alive.length);
    if (seenRules.current === null) {
      seenRules.current = new Set(now);
      setFreshRules([]);
      return;
    }
    const fresh = now.filter((r) => !seenRules.current!.has(r));
    fresh.forEach((r) => seenRules.current!.add(r));
    setFreshRules(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.rev, st?.phase]);

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
  const names = { uid, who };
  const left = remainingNow(st, receivedAt.current, Date.now());
  const alive = st.alive.includes(uid);
  const picking = st.phase === 'pick';
  const canPick = picking && alive;
  const rev = st.reveal;
  const rules = rulesFor(st.alive.length);
  const secs = secondsLeft(left);
  const hot = left < 5000;
  const showPad = canPick && (lockedVal === null || editing);

  const typeKey = (k: PadKey) => {
    if (!canPick) return;
    if (k === 'back') {
      setDraft((d) => d.slice(0, -1));
    } else if (k === 'lock') {
      if (draft === '') return;
      const value = Number(draft);
      setLockedVal(value);
      setEditing(false); // the pad goes away until the next round (or "Change my number")
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

  const overText = () => {
    if (!st.winner) return 'Nobody wins this judgment.';
    return st.winner === uid ? 'You win the game!' : `${name(st.winner)} wins the game!`;
  };

  // The reveal is two screens, one after the other (timing: game/beautyReveal.ts): the numbers and
  // the calculation, then the points lost. `elapsed` is how long the reveal has been running.
  const tl = st.phase === 'reveal' && rev ? buildTimeline(rev) : null;
  const elapsed = tl ? Math.max(0, tl.totalMs - left) : 0;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Round {st.round}</Text>
        <Text style={styles.sub}>{st.alive.length} remaining</Text>
      </View>

      {/* 1. The number pad. After LOCK it goes away until the next round. */}
      {picking && alive && showPad && <PickPad draft={draft} lockedVal={lockedVal} secondsLeft={secs} hot={hot} onKey={typeKey} />}
      {picking && alive && !showPad && lockedVal !== null && (
        <LockedWait
          lockedVal={lockedVal}
          secondsLeft={secs}
          hot={hot}
          locked={st.locked.length}
          total={st.alive.length}
          onChange={() => {
            setDraft(String(lockedVal));
            setEditing(true);
          }}
        />
      )}
      {picking && !alive && <SpectatorWait secondsLeft={secs} locked={st.locked.length} total={st.alive.length} />}
      {/* The special rules in force: a banner under the pad. */}
      {picking && <RuleBanner rules={rules} fresh={freshRules} />}

      {/* 2 and 3. The numbers, the calculation and the winner; then the points lost. */}
      {tl && rev && elapsed < tl.scoresStart && <NumbersStage rev={rev} tl={tl} elapsed={elapsed} n={names} still={reduce} />}
      {tl && rev && elapsed >= tl.scoresStart && <ScoresStage rev={rev} tl={tl} elapsed={elapsed} n={names} name={name} still={reduce} />}

      {st.phase === 'over' && <OverStage text={overText()} order={st.order} pts={st.pts} alive={st.alive} n={names} />}

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
  note: { color: c.goldBright, fontFamily: FONT_ROYAL, fontSize: 15, fontWeight: '600', textAlign: 'center' },
});