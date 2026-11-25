import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  apply,
  bulletsFor,
  CHAMBERS,
  MAX_ROUNDS,
  newGame,
  popcount,
  publicState,
  remainingNow,
  revealMs,
  State,
  tick,
  variantOf,
} from '../game/russianRoulette';
import type { Move } from '../game/russianRoulette';
import * as api from '../lib/api';
import { useReduceMotion } from '../components/ui/useReduceMotion';
import { Blackout, Cylinder, den, FONT_DEN, GunFlash, playSfx, Shake, SILHOUETTES } from '../gameThemes/russianRoulette';
import { AimPanel, deadIds, OverPanel, resolvedAt, Roster, ShotStage, Tray, TopBar, Waiting } from './RouletteStages';
import type { GameProps } from './types';

// Russian Roulette: every player has one life. Each round some live bullets (1 in rounds 1-2, 2 in
// rounds 3-4 ... all 6 in rounds 11-12) are put at the centre of the screen; every player loads them
// into their own revolver, spins the cylinder, and then chooses to shoot another player or themselves.
// When the time is up the gun fires by itself. A live bullet kills its target, unless the target
// fired a blank at themselves in that round (which protects). The last player alive wins.
//
// All the rules live in src/game/russianRoulette.ts. The (lobby) HOST's phone is the only one that
// runs the game: it listens to everybody's moves (saved in lobbies/{code}/roulette), applies them and
// saves the state, which every phone shows. Which chambers were loaded, where each spin stopped and who
// aimed at whom are NOT in the saved state until the reveal, and the other phones only listen to that
// state. If the lobby host forfeits, or closes the app during the game, the others cannot continue
// (known limit, same as Fortune and Xibalba). The forfeit buttons are GameScreen's.
//
// LOOK: a Black Market gambling den (src/gameThemes/russianRoulette/): the six-chamber cylinder is the
// centre of the screen; the shots are shown one by one, a live one is a jumpscare (a flash, a shake, a
// gunshot where the platform has sound or vibration); a player who is shot sees a glimpse of the light
// fade into a black screen.
// Hidden notes kept here on purpose, not on the game screen: where a spin stops is random (so a gun
// with n live bullets fires a live one n times out of 6), a gun that was not aimed in time fires at its
// owner, and a draw happens when nobody or several players survive all the rounds.

const MIC_SPACE = 128; // the lobby's mic pill floats in the top-right corner (VoiceButton): keep clear
const SAVE_GAP_MS = 250; // the lobby host saves the state at most this often
const FINISH_DELAY_MS = 4500;

type Ui = 'load' | 'spinning' | 'closed';

export function RussianRouletteGame({ seed, uid, onFinish, room }: GameProps) {
  const [st, setSt] = useState<State | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [ui, setUi] = useState<Ui>('load');
  const [chambers, setChambers] = useState<boolean[]>(() => Array.from({ length: CHAMBERS }, () => false));
  const [spinKey, setSpinKey] = useState(0);
  const [aimed, setAimed] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const [shake, setShake] = useState(0);
  const [, setFrame] = useState(0); // re-render a few times per second for the countdown
  const reduce = useReduceMotion();
  const receivedAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const finished = useRef(false);
  const lastResolved = useRef({ rev: -1, n: 0 });
  const roomRef = useRef(room);
  roomRef.current = room;
  const host = useRef<{
    state: State | null;
    pending: State | null;
    writing: boolean;
    lastWrite: number;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ state: null, pending: null, writing: false, lastWrite: 0, timer: null });

  // Subscribe to the game. The lobby host also runs it.
  useEffect(() => {
    const r = roomRef.current;
    if (!r) return;
    const round = { matchId: r.matchId, roundNo: r.roundNo };
    const h = host.current;
    const withClock = (s: State): State => ({
      ...publicState(s),
      remainingMs: s.endsAt ? Math.max(0, s.endsAt - Date.now()) : 0,
    });
    const showState = (s: State) => {
      receivedAt.current = Date.now();
      setSt(s);
    };

    // Save the latest state (one write at a time, not more often than SAVE_GAP_MS; only the newest matters).
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
        .writeRouletteState(r.code, round, s.ver, JSON.stringify(withClock(s)))
        .catch((e) => console.warn('saving the game failed', e))
        .finally(() => {
          h.writing = false;
          flush();
        });
    };
    const hostSet = (s: State) => {
      h.state = s;
      h.pending = s;
      showState(withClock(s));
      flush();
    };

    const unsubscribe = api.subscribeRoulette(
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
          if (docState) showState(docState);
          return;
        }
        // LOBBY HOST: start the game, then apply the new moves.
        if (!h.state) {
          if (docState) {
            h.state = docState;
            showState(docState);
          } else {
            hostSet(newGame(r.playerIds, seed, Date.now()));
          }
        }
        let s = h.state!;
        const moves = snap.moves.filter((m) => m.matchId === round.matchId && m.roundNo === round.roundNo).sort((a, b) => a.at - b.at);
        for (const m of moves) {
          const move: Move =
            m.kind === 'load'
              ? { kind: 'load', uid: m.uid, rev: m.rev, mask: m.mask ?? -1, at: m.at }
              : { kind: 'aim', uid: m.uid, rev: m.rev, target: m.target ?? '', at: m.at };
          s = apply(s, move);
        }
        if (s !== h.state) hostSet(s);
      },
      (e) => console.warn('game listener failed', e)
    );

    // LOBBY HOST: the timers (the round, the reveal) and players who forfeited.
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
      if (h.timer) clearTimeout(h.timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => f + 1), 100);
    return () => clearInterval(id);
  }, []);

  // A new round or phase: an empty cylinder, nothing aimed yet.
  useEffect(() => {
    setUi('load');
    setChambers(Array.from({ length: CHAMBERS }, () => false));
    setAimed(null);
  }, [st?.rev]);

  // The shots of the reveal: every live one is a jumpscare (a flash, a shake, a gunshot); a blank is a click.
  const resolvedNow = st && st.phase === 'reveal' && st.reveal ? resolvedAt(st.reveal, revealMs(st.reveal) - remainingNow(st, receivedAt.current, Date.now())) : 0;
  useEffect(() => {
    if (!st || st.phase !== 'reveal' || !st.reveal) {
      lastResolved.current = { rev: st?.rev ?? -1, n: 0 };
      return;
    }
    if (lastResolved.current.rev !== st.rev) lastResolved.current = { rev: st.rev, n: 0 };
    for (let i = lastResolved.current.n; i < resolvedNow; i++) {
      const shot = st.reveal.shots[i];
      if (shot.live) {
        setFlash((k) => k + 1);
        setShake((k) => k + 1);
        playSfx('bang');
      } else {
        playSfx('click');
      }
    }
    lastResolved.current.n = resolvedNow;
  }, [resolvedNow, st?.rev, st?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // The game is over: after a moment everybody reports. Only the winner "finished".
  useEffect(() => {
    if (st?.phase !== 'over' || finished.current) return;
    const id = setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onFinish({ finished: st.winner === uid, totalMs: Date.now() - startedAt.current });
    }, FINISH_DELAY_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.phase, st?.winner]);

  if (!room) {
    return (
      <View style={styles.waiting}>
        <Text style={styles.waitingTitle}>Russian Roulette needs other players</Text>
        <Text style={styles.waitingText}>Create or join a lobby to play it.</Text>
      </View>
    );
  }
  if (!st) {
    return (
      <View style={styles.waiting}>
        <Text style={styles.waitingText}>The den is filling with smoke…</Text>
      </View>
    );
  }

  const name = (id: string) => room.usernames[id] ?? 'A player';
  const n = { uid, who: (id: string) => (id === uid ? 'You' : name(id)), variant: (id: string) => variantOf(seed, id, SILHOUETTES) };
  const left = remainingNow(st, receivedAt.current, Date.now());
  const secs = Math.max(0, Math.ceil(left / 1000));
  const alive = st.alive.includes(uid);
  const playing = st.phase === 'play';
  const fired = st.fired.includes(uid);
  const loadedCount = chambers.filter(Boolean).length;
  // after a restart of this screen the host may already know my spin: the cylinder is closed
  const shownUi: Ui = ui === 'load' && st.spun.includes(uid) ? 'closed' : ui;
  const elapsed = st.phase === 'reveal' && st.reveal ? revealMs(st.reveal) - left : 0;

  // Is my screen black? After the shot that killed me has landed, and for good from then on.
  const myDeathShot = st.reveal ? st.reveal.shots.findIndex((s) => (s.outcome === 'suicide' && s.uid === uid) || (s.outcome === 'hit' && s.aim === uid)) : -1;
  const iWasInTheReveal = !!st.reveal?.shots.some((s) => s.uid === uid);
  const black = alive
    ? false
    : st.phase === 'reveal'
      ? iWasInTheReveal
        ? myDeathShot >= 0 && resolvedNow > myDeathShot
        : true
      : true;

  const sendMove = (move: { kind: 'load'; mask: number } | { kind: 'aim'; target: string }) =>
    api.sendRouletteMove(room.code, { matchId: room.matchId, roundNo: room.roundNo }, { rev: st.rev, ...move });

  const toggleChamber = (i: number) => {
    if (!playing || !alive || shownUi !== 'load') return;
    setChambers((c) => {
      const next = c.slice();
      if (next[i]) next[i] = false;
      else if (c.filter(Boolean).length < st.bullets) next[i] = true;
      else return c;
      playSfx('load');
      return next;
    });
  };

  const spin = () => {
    if (!playing || shownUi !== 'load' || loadedCount !== st.bullets) return;
    const mask = chambers.reduce((m, on, i) => (on ? m | (1 << i) : m), 0);
    if (popcount(mask) !== st.bullets) return;
    setUi('spinning');
    setSpinKey((k) => k + 1);
    playSfx('spin');
    sendMove({ kind: 'load', mask }).catch((e) => {
      setUi('load');
      console.warn('loading failed', e);
    });
  };

  const aim = (target: string) => {
    if (!playing || shownUi !== 'closed' || fired || aimed !== null) return;
    setAimed(target);
    sendMove({ kind: 'aim', target }).catch((e) => {
      setAimed(null);
      console.warn('aiming failed', e);
    });
  };

  const cylSize = Math.max(110, Math.min(area.w * 0.78, area.h * (playing ? (shownUi === 'closed' ? 0.4 : 0.64) : 0.34), 260));
  const survivors = st.reveal ? st.reveal.survivors.length : st.alive.length;
  const nextBullets = st.reveal && survivors > 1 && st.round < MAX_ROUNDS ? bulletsFor(st.round + 1) : null;
  const deadNow = st.phase === 'reveal' && st.reveal ? deadIds(st.reveal, resolvedNow) : null;

  return (
    <Shake k={shake} still={reduce}>
      <View style={styles.root}>
        <TopBar st={st} secs={secs} timed={playing} marginRight={MIC_SPACE} />

        <View style={styles.hero} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {st.phase === 'play' && (
            <View style={styles.center}>
              {alive ? (
                <>
                  <Cylinder
                    size={cylSize}
                    loaded={chambers}
                    closed={shownUi === 'closed'}
                    onChamber={shownUi === 'load' ? toggleChamber : undefined}
                    spinKey={spinKey}
                    onSpinEnd={() => {
                      setUi('closed');
                      playSfx('close');
                    }}
                    still={reduce}
                  />
                  {shownUi === 'load' && <Tray total={st.bullets} loaded={loadedCount} canSpin={loadedCount === st.bullets} onSpin={spin} />}
                  {shownUi === 'spinning' && <Text style={styles.hint}>Spinning…</Text>}
                  {shownUi === 'closed' && !fired && aimed === null && <AimPanel st={st} n={n} onAim={aim} />}
                  {shownUi === 'closed' && (fired || aimed !== null) && <Waiting st={st} target={aimed} n={n} />}
                </>
              ) : (
                <Text style={styles.hint}>You are out. The round goes on…</Text>
              )}
            </View>
          )}
          {st.phase === 'reveal' && st.reveal && (
            <View style={styles.center}>
              <ShotStage rev={st.reveal} elapsed={elapsed} n={n} cylSize={Math.min(96, cylSize)} still={reduce} survivors={survivors} nextBullets={nextBullets} />
            </View>
          )}
          {st.phase === 'over' && (
            <View style={styles.center}>
              <OverPanel st={st} n={n} />
            </View>
          )}
        </View>

        <Roster st={st} n={n} shown={deadNow} />
        {st.lastLeft && st.phase !== 'over' && <Text style={styles.note}>{name(st.lastLeft)} left the den.</Text>}
      </View>

      <GunFlash k={flash} still={reduce} />
      <Blackout active={black} still={reduce}>
        <Text style={styles.blackText}>YOU ARE OUT</Text>
        <Text style={styles.blackSub}>
          {st.alive.length} {st.alive.length === 1 ? 'gambler' : 'gamblers'} still standing
        </Text>
      </Blackout>
    </Shake>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, gap: 8 },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24 },
  waitingTitle: { color: den.gold, fontFamily: FONT_DEN, fontSize: 20, letterSpacing: 1, textAlign: 'center' },
  waitingText: { color: den.bone, fontFamily: FONT_DEN, fontSize: 15, textAlign: 'center' },
  hero: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hint: { color: den.boneMuted, fontFamily: FONT_DEN, fontSize: 16, letterSpacing: 1, textAlign: 'center' },
  note: { color: den.boneMuted, fontFamily: FONT_DEN, fontSize: 12, textAlign: 'center' },
  blackText: { color: '#3A0A0D', fontFamily: FONT_DEN, fontSize: 30, letterSpacing: 4 },
  blackSub: { color: '#2B2B2B', fontFamily: FONT_DEN, fontSize: 14, marginTop: 6 },
});
