import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Keyboard, Platform, StyleSheet, Text, View } from 'react-native';
import {
  apply,
  cleanAnswer,
  DRAW_LANDS_MS,
  DRAW_MS,
  newGame,
  presentOf,
  publicState,
  QUESTIONS_PER_GAME,
  remainingNow,
  State,
  tick,
  uncoveredCount,
} from '../game/pleasure';
import type { Move } from '../game/pleasure';
import * as api from '../lib/api';
import { useReduceMotion } from '../components/ui/useReduceMotion';
import { useGameSounds } from '../audio';
import { Bear, Confetti, FONT_SHOW, playSfx, SFX_CAPTIONS, SfxPop, show, Telop } from '../gameThemes/pleasure';
import type { Mood, SfxName } from '../gameThemes/pleasure';
import { AskScreen, DrawScreen, GuessScreen, OverScreen, RevealScreen } from './PleasureScreens';
import type { GameProps } from './types';

// Pleasure: a variety-show quiz. A bear asks 5 personal questions and everybody answers in secret.
// Then one player is drawn to be the Host; the questions come back one at a time and everybody else
// must pick, out of 4 choices, the answer the Host gave (the other 3 choices are other players'
// answers). If the players uncover 4 or more of the Host's answers the Host wins; a player who
// guessed every answer wins instead.
//
// All the rules live in src/game/pleasure.ts. The (lobby) HOST's phone is the only one that runs the
// game: it listens to everybody's moves (saved in lobbies/{code}/pleasure), applies them and saves
// the state, which every phone shows. The answers and the right choice are NOT in the saved state
// until each reveal, and the other phones only listen to that state (they never download the
// answers). If the lobby host forfeits, or closes the app during the game, the others cannot
// continue (known limit, same as Fortune and Xibalba). The forfeit buttons are GameScreen's.
//
// LOOK: a Japanese variety-show TV studio (src/gameThemes/pleasure/): the bear host with his
// speech bubble, big TV screens, comic sound captions (PIN-PON!, BUBU-!...), confetti, a scoreboard.
// Hidden notes kept here on purpose, not on the game screen: how many answers the Host needs to be
// uncovered for the Host to win, and that a shared perfect score is a draw.

const MIC_SPACE = 128; // the lobby's mic pill floats in the top-right corner (VoiceButton): keep clear
const SAVE_GAP_MS = 250; // the lobby host saves the state at most this often
const FINISH_DELAY_MS = 4500;

function OnAir({ still }: { still: boolean }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.3, duration: 600, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 600, easing: Easing.linear, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [still, v]);
  return (
    <View style={styles.onAir}>
      <Animated.View style={[styles.onAirDot, { opacity: v }]} />
      <Text style={styles.onAirText}>ON AIR</Text>
    </View>
  );
}

export function PleasureGame({ seed, uid, onFinish, room }: GameProps) {
  const [st, setSt] = useState<State | null>(null);
  const [draft, setDraft] = useState('');
  const [sentText, setSentText] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);
  useGameSounds('pleasure'); // loads the show's sounds now, frees them when the game closes (they play via playSfx)
  const [ev, setEv] = useState<{ k: number; name: SfxName }>({ k: 0, name: 'pop' });
  const [confetti, setConfetti] = useState(0);
  const [, setFrame] = useState(0); // re-render a few times per second for the countdown
  const reduce = useReduceMotion();
  const receivedAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const finished = useRef(false);
  const mine = useRef<string[]>([]); // my own answers, for my own screen when I am the Host
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
        .writePleasureState(r.code, round, s.ver, JSON.stringify(withClock(s)))
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

    const unsubscribe = api.subscribePleasure(
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
            m.kind === 'answer'
              ? { kind: 'answer', uid: m.uid, rev: m.rev, q: m.q, text: m.text ?? '', at: m.at }
              : { kind: 'guess', uid: m.uid, rev: m.rev, q: m.q, choice: m.choice ?? -1, at: m.at };
          s = apply(s, move);
        }
        if (s !== h.state) hostSet(s);
      },
      (e) => console.warn('game listener failed', e)
    );

    // LOBBY HOST: the timers (questions, the draw, the reveals) and players who forfeited.
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
    const id = setInterval(() => setFrame((f) => f + 1), 150);
    return () => clearInterval(id);
  }, []);

  // While typing the keyboard takes the room: the bear and the scoreboard step aside.
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setTyping(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setTyping(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  // A new question or phase: nothing typed or picked yet.
  useEffect(() => {
    setDraft('');
    setSentText(null);
    setPicked(null);
  }, [st?.rev]);

  // The show's sound effects, and the confetti, for every new phase.
  useEffect(() => {
    if (!st) return;
    let name: SfxName | null = null;
    let party = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    switch (st.phase) {
      case 'ask':
        name = 'pop';
        break;
      case 'draw':
        name = 'drum';
        // the roulette lands: the big bang (see DrawScreen)
        timer = setTimeout(() => {
          setEv((e) => ({ k: e.k + 1, name: 'fanfare' }));
          playSfx('fanfare');
          setConfetti((c) => c + 1);
        }, DRAW_LANDS_MS);
        break;
      case 'guess':
        name = 'quiz';
        break;
      case 'reveal': {
        const won = !!st.reveal && st.reveal.right.length > 0;
        name = won ? 'pinpon' : 'bubu';
        party = won;
        break;
      }
      case 'over':
        name = st.winner ? 'win' : 'bubu';
        party = !!st.winner;
        break;
    }
    if (name) {
      const n = name;
      setEv((e) => ({ k: e.k + 1, name: n }));
      playSfx(n);
    }
    if (party) setConfetti((c) => c + 1);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [st?.rev]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <Telop size={20}>Pleasure needs other players</Telop>
        <Text style={styles.waitingText}>Create or join a lobby to play it.</Text>
      </View>
    );
  }
  if (!st) {
    return (
      <View style={styles.waiting}>
        <Telop size={18}>The studio is warming up…</Telop>
      </View>
    );
  }

  const name = (id: string) => room.usernames[id] ?? 'A player';
  const who = (id: string) => (id === uid ? 'You' : name(id));
  const n = { uid, who };
  const left = remainingNow(st, receivedAt.current, Date.now());
  const secs = Math.max(0, Math.ceil(left / 1000));
  const present = presentOf(st);
  const isHost = st.host === uid;
  const guessers = present.filter((id) => id !== st.host);
  const timed = st.phase === 'ask' || st.phase === 'guess';

  const send = (move: { kind: 'answer'; text: string } | { kind: 'guess'; choice: number }) =>
    api.sendPleasureMove(room.code, { matchId: room.matchId, roundNo: room.roundNo }, { rev: st.rev, q: st.qi, ...move });

  const sendAnswer = () => {
    if (st.phase !== 'ask') return;
    const text = cleanAnswer(draft);
    if (text === '') return;
    mine.current[st.qi] = text;
    setSentText(text);
    send({ kind: 'answer', text }).catch((e) => {
      setSentText(null);
      console.warn('sending the answer failed', e);
    });
  };

  const pick = (i: number) => {
    if (st.phase !== 'guess' || isHost || picked !== null) return;
    setPicked(i);
    send({ kind: 'guess', choice: i }).catch((e) => {
      setPicked(null);
      console.warn('sending the guess failed', e);
    });
  };

  // The bear's mood and what he says.
  const landed = st.phase === 'draw' && left <= DRAW_MS - DRAW_LANDS_MS;
  const bear = ((): { mood: Mood; line: string } => {
    switch (st.phase) {
      case 'ask':
        return { mood: 'happy', line: `Question ${st.qi + 1}! Tell me the truth, kuma!` };
      case 'draw':
        return landed ? { mood: 'cheer', line: `${who(st.host!)} ${st.host === uid ? 'are' : 'is'} today's Host!` } : { mood: 'wow', line: "Who will be today's Host…?" };
      case 'guess':
        return isHost ? { mood: 'cheer', line: 'Poker face, Host!' } : { mood: 'think', line: `Which one is ${who(st.host!)}'s real answer?` };
      case 'reveal': {
        const r = st.reveal!;
        if (r.skipped) return { mood: 'sad', line: 'No answer? How mysterious!' };
        return r.right.length > 0 ? { mood: 'cheer', line: 'PIN-PON! We have a winner!' } : { mood: 'sad', line: 'BUBU-! Nobody knew!' };
      }
      default:
        return st.winner ? { mood: 'cheer', line: 'What a show! Congratulations!' } : { mood: 'sad', line: 'No winner today. See you next time!' };
    }
  })();

  const cap = SFX_CAPTIONS[ev.name];
  const answered = st.done.length;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* on air, the logo and the clock */}
      <View style={[styles.topRow, { marginRight: MIC_SPACE }]}>
        <OnAir still={reduce} />
        <View style={{ flex: 1 }}>
          <Telop size={20} color={show.yellow} align="left">
            PLEASURE!
          </Telop>
        </View>
        {timed && (
          <View style={[styles.clock, secs <= 5 && { borderColor: show.red }]} accessibilityLabel={`${secs} seconds left`}>
            <Text style={[styles.clockText, secs <= 5 && { color: show.red }]}>{secs}</Text>
          </View>
        )}
      </View>

      {/* the bear host */}
      {!typing && (
        <View style={styles.bearRow}>
          <Bear mood={bear.mood} size={84} still={reduce} />
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{bear.line}</Text>
          </View>
        </View>
      )}

      {/* the big screen */}
      <View style={{ flex: 1 }}>
        {st.phase === 'ask' && (
          <AskScreen
            st={st}
            draft={draft}
            onDraft={setDraft}
            sent={sentText !== null && sentText === cleanAnswer(draft)}
            onSend={sendAnswer}
            answered={answered}
            total={present.length}
          />
        )}
        {st.phase === 'draw' && <DrawScreen st={st} n={n} left={left} />}
        {st.phase === 'guess' && (
          <GuessScreen st={st} n={n} picked={picked} onPick={pick} myAnswer={mine.current[st.qi] ?? ''} guessed={answered} total={guessers.length} />
        )}
        {st.phase === 'reveal' && st.reveal && <RevealScreen st={st} n={n} />}
        {st.phase === 'over' && <OverScreen st={st} n={n} />}
      </View>

      {/* the scoreboard */}
      {!typing && (
        <View style={styles.board}>
          {present.map((id) => {
            const isH = id === st.host;
            const ticked = (st.phase === 'ask' || st.phase === 'guess') && st.done.includes(id);
            return (
              <View key={id} style={[styles.chip, id === uid && styles.chipMe, isH && styles.chipHost]}>
                <Text style={styles.chipName} numberOfLines={1}>
                  {isH ? '★ ' : ''}
                  {who(id)}
                  {ticked ? ' ✔' : ''}
                </Text>
                {st.host && (
                  <Text style={styles.chipScore}>
                    {isH ? `${uncoveredCount(st)}/${QUESTIONS_PER_GAME} found` : `${st.scores[id] ?? 0} pts`}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      <SfxPop text={cap.text} color={cap.color} k={ev.k} still={reduce} />
      <Confetti k={confetti} still={reduce} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, gap: 8 },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  waitingText: { color: show.white, fontFamily: FONT_SHOW, fontSize: 14, textAlign: 'center' },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  onAir: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: show.ink, borderColor: show.red, borderWidth: 2, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  onAirDot: { width: 9, height: 9, borderRadius: 9, backgroundColor: show.red },
  onAirText: { color: show.white, fontFamily: FONT_SHOW, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  clock: { minWidth: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: show.ink, borderColor: show.yellow, borderWidth: 3 },
  clockText: { color: show.yellow, fontFamily: FONT_SHOW, fontWeight: '900', fontSize: 20 },

  bearRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bubble: { flex: 1, backgroundColor: show.white, borderColor: show.ink, borderWidth: 3, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, minHeight: 50, justifyContent: 'center' },
  bubbleText: { color: show.ink, fontFamily: FONT_SHOW, fontWeight: '800', fontSize: 14, lineHeight: 18 },

  board: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minWidth: '23%', flexGrow: 1, backgroundColor: 'rgba(18,7,68,0.85)', borderColor: 'rgba(189,176,240,0.4)', borderWidth: 2, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  chipMe: { borderColor: show.cyan },
  chipHost: { borderColor: show.yellow },
  chipName: { color: show.white, fontFamily: FONT_SHOW, fontWeight: '800', fontSize: 12 },
  chipScore: { color: show.yellow, fontFamily: FONT_SHOW, fontWeight: '900', fontSize: 11 },
});
