import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from '../components/ui';
import {
  allowedFor,
  allowedThrows,
  bannedFor,
  END_CODE,
  endStatus,
  FINAL_MS,
  followA,
  followB,
  INITIAL_MS,
  MAX_ROUNDS,
  NEGOTIATION_MS,
  othersOf,
  parsePromise,
  promiseCode,
  promiseLines,
  promiseOf,
  promiseTitle,
  replay,
  REVEAL_MS,
  SCORE_OFFSET,
  setLabel,
  THROW_ICON,
  THROW_LABEL,
  THROWS,
  WAIT_REVEAL_MS,
} from '../game/janken';
import type { JankenDoc, PromiseKind, SetChoice, Throw } from '../game/janken';
import { colors, radius } from '../theme';
import type { GameProps } from './types';

// Janken Negotiation. Every round (all rules are in src/game/janken.ts):
//   1. pick an INITIAL throw (8 s)
//   2. negotiate (30 s): the INITIAL throw is PUBLIC and can be changed any time. Long-press a throw to make a
//      promise: "I promise to pick ROCK" / "I promise NOT to pick ROCK", with follow-ups that say what happens
//      to you next round if you kept it or lied. The promise itself is not enforced, but the game checks your
//      real final throw at the reveal and disables the throws you agreed to lose in the next round.
//   3. FINAL throw (last 5 s): pick the real FINAL throw in private (others still see your initial throw)
//   4. everybody's final throw is revealed at once
// All the notes (own and the opponent's) are in one collapsible panel under the phase text.

type Phase = 'pick' | 'negotiate' | 'final' | 'wait' | 'reveal' | 'done';
const BOT = 'bot';
const pickOne = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const without = (list: string[], v: string) => list.filter((x) => x !== v);
const withIt = (list: string[], v: string) => (list.includes(v) ? list : [...list, v]);

type Mine = { initial: '' | Throw; offers: string[]; acc: string[]; rej: string[] };
const EMPTY: Mine = { initial: '', offers: [], acc: [], rej: [] };

export function JankenNegotiationGame({ seed, uid, onFinish, room }: GameProps) {
  const { width } = useWindowDimensions();
  const practice = !room;
  const players = room ? room.playerIds : [uid, BOT];
  const out = room ? room.out : [];
  const names: Record<string, string> = room ? room.usernames : { [BOT]: 'Hatter Bot' };
  const nameOf = (p: string) => (p === uid ? 'You' : names[p] ?? 'Player');

  const [k, setK] = useState(1);
  const [phase, setPhase] = useState<Phase>('pick');
  const [final, setFinal] = useState<Throw | null>(null);
  const [mine, setMine] = useState<Mine>(EMPTY);
  const [menuFor, setMenuFor] = useState<Throw | null>(null);
  const [view, setView] = useState<PromiseKind | null>(null); // which promise is being built
  const [fa, setFa] = useState(true); // follow-up a chosen
  const [fb, setFb] = useState(false); // follow-up b chosen
  const [fset, setFset] = useState<SetChoice | null>(null); // for follow-up b: which throws get disabled
  const [notesOpen, setNotesOpen] = useState(false);
  const [seenNotes, setSeenNotes] = useState('');
  const [left, setLeft] = useState(INITIAL_MS);
  const [sendError, setSendError] = useState<string | null>(null);
  const [local, setLocal] = useState<JankenDoc[]>([]); // practice run: my docs and the bot's

  const docs: JankenDoc[] = room ? room.janken?.docs ?? [] : local;
  const docsRef = useRef(docs);
  docsRef.current = docs;
  const finalRef = useRef<Throw | null>(null);
  const mineRef = useRef(mine);
  mineRef.current = mine;
  const phaseStart = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const reported = useRef(false);
  const lastSent = useRef<JankenDoc | null>(null);
  const bot = useRef<{ endAnswer: boolean | null }>({ endAnswer: null });

  // ---- who plays whom this round, and the score so far
  const before = replay(seed, players, out, docs, k - 1);
  const now = replay(seed, players, out, docs, k);
  const round = now.rounds[k - 1];
  const myPair = round?.pairs.find(([a, b]) => a === uid || b === uid);
  const opp = myPair ? (myPair[0] === uid ? myPair[1] : myPair[0]) : null;
  const prevThrow = before.prev[uid] ?? null;
  const docOf = (p: string) => docs.find((d) => d.uid === p && d.k === k);
  const oppDoc = opp ? docOf(opp) : undefined;
  const oppName = opp ? nameOf(opp) : '';
  const myDoc: JankenDoc = { uid, k, initial: mine.initial, offers: mine.offers, acc: mine.acc, rej: mine.rej, throw: '' };

  // Throws disabled for you this round: Forced Rotation + what your earlier promises cost you.
  const banned = bannedFor(before.carry, uid, k);
  const allowed = allowedFor(prevThrow, banned);
  const myPromise = promiseOf(myDoc);
  const oppPromise = promiseOf(oppDoc);

  // ---- publish my initial throw / promise / answers (the FINAL throw stays hidden until the reveal)
  const save = (doc: JankenDoc) => {
    lastSent.current = doc;
    if (room?.janken) {
      room.janken
        .save(doc.k, { initial: doc.initial, offers: doc.offers, acc: doc.acc, rej: doc.rej, throw: doc.throw })
        .then(() => setSendError(null))
        .catch((e) => setSendError((e as { code?: string } | null)?.code ?? (e instanceof Error ? e.message : 'unknown error')));
    } else {
      setLocal((d) => [...d.filter((x) => !(x.uid === doc.uid && x.k === doc.k)), doc]);
    }
  };
  const publish = (patch: Partial<Mine>) => {
    const next = { ...mineRef.current, ...patch };
    mineRef.current = next;
    setMine(next);
    if (opp) save({ uid, k, ...next, throw: '' });
  };

  const choose = (t: Throw) => {
    if (!opp || !allowed.includes(t)) return;
    if (phase === 'pick' || phase === 'negotiate') {
      publish({ initial: t }); // the INITIAL throw: public, can change until the final phase
    } else if (phase === 'final') {
      finalRef.current = t; // the latest valid selection before the time is up is the FINAL throw
      setFinal(t);
    }
  };

  const allowedFresh = () => {
    const b = replay(seed, players, out, docsRef.current, k - 1);
    return allowedFor(b.prev[uid] ?? null, bannedFor(b.carry, uid, k));
  };

  // ---- phase timers
  useEffect(() => {
    phaseStart.current = Date.now();
    const countdown = (ms: number) => {
      setLeft(ms);
      return setInterval(() => setLeft(Math.max(0, phaseStart.current + ms - Date.now())), 200);
    };
    if (phase === 'pick') {
      const tick = countdown(INITIAL_MS);
      const stop = setTimeout(() => {
        if (opp && !mineRef.current.initial) publish({ initial: pickOne(allowedFresh()) }); // never committed: random
        setPhase('negotiate');
      }, INITIAL_MS);
      return () => {
        clearInterval(tick);
        clearTimeout(stop);
      };
    }
    if (phase === 'negotiate') {
      const tick = countdown(NEGOTIATION_MS);
      const stop = setTimeout(() => {
        closeMenu();
        // Final-throw phase starts with the initial throw selected (if allowed); change it if you want.
        const init = mineRef.current.initial;
        const start = init && allowedFresh().includes(init) ? init : null;
        finalRef.current = start;
        setFinal(start);
        setPhase('final');
      }, NEGOTIATION_MS);
      return () => {
        clearInterval(tick);
        clearTimeout(stop);
      };
    }
    if (phase === 'final') {
      const tick = countdown(FINAL_MS);
      const stop = setTimeout(() => {
        if (opp) {
          const ok = allowedFresh();
          const t = finalRef.current && ok.includes(finalRef.current) ? finalRef.current : pickOne(ok);
          finalRef.current = t;
          setFinal(t);
          save({ uid, k, ...mineRef.current, throw: t }); // the reveal
        }
        setPhase('wait');
      }, FINAL_MS);
      return () => {
        clearInterval(tick);
        clearTimeout(stop);
      };
    }
    if (phase === 'wait') {
      // Show the reveal once every pair's throws are in (or after a grace period: that player no-showed).
      const check = setInterval(() => {
        const r = replay(seed, players, out, docsRef.current, k).rounds[k - 1];
        const missing = r.pairs.flat().filter((p) => !docsRef.current.some((d) => d.uid === p && d.k === k && d.throw));
        if (missing.length === 0 || Date.now() - phaseStart.current > WAIT_REVEAL_MS) setPhase('reveal');
      }, 300);
      return () => clearInterval(check);
    }
    if (phase === 'reveal') {
      const stop = setTimeout(() => {
        const after = replay(seed, players, out, docsRef.current, k);
        const active = players.filter((p) => !out.includes(p) && !after.left.includes(p));
        if (after.left.includes(uid) || k >= MAX_ROUNDS || active.length < 2) {
          finish(after.score[uid] ?? 0);
          setPhase('done');
          return;
        }
        finalRef.current = null;
        setFinal(null);
        mineRef.current = EMPTY;
        setMine(EMPTY);
        closeMenu();
        bot.current = { endAnswer: null };
        setK(k + 1);
        setPhase('pick');
      }, REVEAL_MS);
      return () => clearTimeout(stop);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, k]);

  const finish = (net: number) => {
    if (reported.current) return;
    reported.current = true;
    onFinish({ finished: true, totalMs: Date.now() - startedAt.current, score: Math.max(0, Math.min(1000, SCORE_OFFSET + net)) });
  };

  // ---- practice run: a simple bot opponent that sometimes makes a promise and answers an END offer
  useEffect(() => {
    if (!practice || !opp || (phase !== 'negotiate' && phase !== 'pick')) return;
    const cur = local.find((d) => d.uid === BOT && d.k === k);
    const botPrev = before.prev[BOT] ?? null;
    let base = cur;
    if (!base) {
      const initial = pickOne(allowedFor(botPrev, bannedFor(before.carry, BOT, k)));
      const t = pickOne(THROWS);
      const offers = Math.random() < 0.7
        ? [promiseCode(pickOne<PromiseKind>(['pick', 'avoid']), t, Math.random() < 0.6, Math.random() < 0.6 ? pickOne<SetChoice>([...othersOf(t), 'both']) : null)]
        : [];
      base = { uid: BOT, k, initial, offers, acc: [], rej: [], throw: '' };
    }
    let acc = base.acc;
    let rej = base.rej;
    if (mine.offers.includes(END_CODE) && !acc.includes(END_CODE) && !rej.includes(END_CODE)) {
      bot.current.endAnswer ??= Math.random() < 0.6;
      if (bot.current.endAnswer) acc = [END_CODE];
      else rej = [END_CODE];
    }
    if (!cur || acc.join() !== cur.acc.join() || rej.join() !== cur.rej.join()) {
      setLocal((d) => [...d.filter((x) => !(x.uid === BOT && x.k === k)), { ...base!, acc, rej }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice, phase, k, mine.offers.join()]);

  useEffect(() => {
    if (!practice || phase !== 'wait') return;
    setLocal((d) => {
      const cur = d.find((x) => x.uid === BOT && x.k === k);
      if (!cur || cur.throw) return d;
      const b = replay(seed, players, out, d, k - 1);
      const ok = allowedFor(b.prev[BOT] ?? null, bannedFor(b.carry, BOT, k));
      // The bot usually keeps its initial throw, but sometimes switches (it can bluff and lie too).
      const t = cur.initial && ok.includes(cur.initial) && Math.random() < 0.7 ? cur.initial : pickOne(ok);
      return d.map((x) => (x === cur ? { ...cur, throw: t } : x));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice, phase, k]);

  // ------------------------------------------------------------------ promise + end-match actions
  const negotiating = phase === 'negotiate' && !!opp;
  const myEnd = endStatus(myDoc, oppDoc);
  const theirEnd = oppDoc?.offers.includes(END_CODE) ?? false;
  const theirEndStatus = endStatus(oppDoc, myDoc);
  const makePromise = (code: string) => publish({ offers: [code, ...mine.offers.filter((c) => !parsePromise(c))] });
  const withdrawPromise = () => publish({ offers: mine.offers.filter((c) => !parsePromise(c)) });
  const offerEnd = () => publish({ offers: withIt(mine.offers, END_CODE) });
  const withdrawEnd = () => publish({ offers: without(mine.offers, END_CODE) });
  const answerEnd = (yes: boolean) =>
    publish({ acc: yes ? withIt(mine.acc, END_CODE) : without(mine.acc, END_CODE), rej: yes ? without(mine.rej, END_CODE) : withIt(mine.rej, END_CODE) });

  // ------------------------------------------------------------------ notes (one panel)
  const rulesNotes = (): string[] => {
    const n: string[] = [];
    if (!opp && phase !== 'done') n.push('Bye this round: nobody to play.');
    if (prevThrow) {
      n.push(`Previous Throw: ${THROW_LABEL[prevThrow]}.`);
      n.push(`Forced Rotation: ${allowedThrows(prevThrow).map((t) => THROW_LABEL[t]).join(' / ')} only.`);
    }
    if (banned.length > 0) n.push(`Promise consequence: you cannot pick ${banned.map((t) => THROW_LABEL[t]).join(' / ')} this round.`);
    if (phase === 'final') n.push('Initial Throw locked. Pick your Final Throw.');
    if (phase === 'wait' || phase === 'reveal') n.push('Current Status: Final Throw Locked.');
    return n;
  };
  const mineNotes = phase === 'done' ? [] : rulesNotes();
  const showOpp = phase !== 'done' && !!opp;
  const myPromiseLines = showOpp && myPromise ? promiseLines(myPromise.code) : [];
  const theirPromiseLines = showOpp && oppPromise ? promiseLines(oppPromise.code) : [];
  const noteCount =
    mineNotes.length + (myPromiseLines.length > 0 ? 1 : 0) + (theirPromiseLines.length > 0 ? 1 : 0) + (showOpp && (mine.offers.includes(END_CODE) || theirEnd) ? 1 : 0);

  // The opponent's promise / end offer light the pill up until you open the panel.
  const theirSig = `${oppPromise?.code ?? ''}|${theirEnd ? theirEndStatus : ''}`;
  const hasNew = theirSig !== '|' && theirSig !== seenNotes;
  useEffect(() => {
    if (notesOpen) setSeenNotes(theirSig);
  }, [notesOpen, theirSig]);

  // ------------------------------------------------------------------ circle of players
  const size = Math.min(width - 24, 400);
  const boxW = 100;
  const radiusPx = (size - boxW) / 2;
  const alive = players.filter((p) => !out.includes(p));
  const order = [uid, ...alive.filter((p) => p !== uid)]; // I am at the bottom of the circle
  const center = size / 2;

  const reveal = phase === 'reveal' || phase === 'done';
  const lineOf = (p: string) => now.lines.find((l) => l.k === k && (l.a === p || l.b === p));

  const Box = ({ p, i }: { p: string; i: number }) => {
    const angle = Math.PI / 2 + (2 * Math.PI * i) / order.length; // i = 0 is at the bottom
    const x = center + radiusPx * Math.cos(angle) - boxW / 2;
    const y = center + radiusPx * Math.sin(angle) - 28;
    const isMe = p === uid;
    const pair = round?.pairs.find(([a, b]) => a === p || b === p);
    const partner = pair ? (pair[0] === p ? pair[1] : pair[0]) : null;
    const line = lineOf(p);
    const shownFinal = line ? (line.a === p ? line.ta : line.tb) : null;
    const gone = before.left.includes(p);
    const initialOf: '' | Throw = isMe ? mine.initial : docOf(p)?.initial ?? '';
    const inFinal = phase === 'final' || phase === 'wait';
    const border = p === opp ? styles.boxOpp : isMe ? styles.boxMe : null;
    return (
      <View style={[styles.box, { left: x, top: y, width: boxW }, border, gone && { opacity: 0.45 }]}>
        <Text style={styles.boxName} numberOfLines={1}>
          {nameOf(p)}
        </Text>
        {!gone && partner ? (
          <>
            <Text style={styles.tag}>{inFinal || reveal ? 'FINAL THROW' : 'INITIAL THROW'}</Text>
            {reveal && shownFinal ? (
              <Text style={styles.revealed}>
                {THROW_ICON[shownFinal]} {THROW_LABEL[shownFinal]}
              </Text>
            ) : (
              <Text style={styles.throwText}>
                {isMe && inFinal && final
                  ? `${THROW_ICON[final]} ${THROW_LABEL[final]}`
                  : initialOf
                    ? `${THROW_ICON[initialOf]} ${THROW_LABEL[initialOf]}`
                    : isMe
                      ? '—'
                      : 'waiting…'}
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.hidden}>{gone ? 'left the match' : 'bye'}</Text>
        )}
      </View>
    );
  };

  // ------------------------------------------------------------------ the negotiation dialog
  function closeMenu() {
    setMenuFor(null);
    setView(null);
  }
  const openPromise = (kind: PromiseKind) => {
    setView(kind);
    setFa(true);
    setFb(false);
    setFset(null);
  };

  const Radio = ({ on, mark, text, onPress }: { on: boolean; mark: [string, string]; text: string; onPress: () => void }) => (
    <Pressable onPress={onPress} style={[styles.radio, on && styles.radioOn]}>
      <Text style={styles.radioMark}>{on ? mark[0] : mark[1]}</Text>
      <Text style={styles.radioText}>{text}</Text>
    </Pressable>
  );

  const renderMenu = () => {
    if (!menuFor) return null;
    const T = THROW_LABEL[menuFor];
    if (!view) {
      return (
        <>
          <Text style={styles.menuTitle}>
            {THROW_ICON[menuFor]} {T} · negotiation
          </Text>
          <Text style={styles.small}>{seconds}s left · the game checks your real throw at the reveal</Text>
          {oppPromise && (
            <View style={styles.sect}>
              <Text style={styles.notesWho}>{oppName} promised</Text>
              {promiseLines(oppPromise.code).map((t, j) => (
                <Text key={j} style={styles.notesLine}>
                  {j === 0 ? '' : '• '}
                  {t}
                </Text>
              ))}
            </View>
          )}
          {(['pick', 'avoid'] as PromiseKind[]).map((kind) => (
            <Pressable key={kind} onPress={() => openPromise(kind)} style={styles.kindBtn}>
              <Text style={styles.kindTitle}>{promiseTitle(kind, menuFor)}</Text>
            </Pressable>
          ))}
          {myPromise && (
            <View style={styles.sect}>
              <Text style={styles.notesWho}>Your promise</Text>
              {promiseLines(myPromise.code).map((t, j) => (
                <Text key={j} style={styles.notesLine}>
                  {j === 0 ? '' : '• '}
                  {t}
                </Text>
              ))}
              <Button label="Take back my promise" variant="secondary" onPress={withdrawPromise} />
            </View>
          )}
          {theirEnd && theirEndStatus !== 'agreed' && !mine.acc.includes(END_CODE) && (
            <View style={styles.sect}>
              <Text style={styles.notesLine}>{oppName} wants to end the match after this round.</Text>
              <View style={styles.rowBtns}>
                <Button label="Accept" onPress={() => answerEnd(true)} style={styles.flex} />
                <Button label="Reject" variant="secondary" onPress={() => answerEnd(false)} style={styles.flex} />
              </View>
            </View>
          )}
          {!theirEnd && (
            <Pressable
              onPress={() => (mine.offers.includes(END_CODE) ? withdrawEnd() : offerEnd())}
              style={styles.kindBtn}
            >
              <Text style={styles.kindTitle}>{mine.offers.includes(END_CODE) ? 'Take back: end the match' : 'END THE MATCH after this round'}</Text>
              <Text style={styles.kindBlurb}>
                {mine.offers.includes(END_CODE)
                  ? myEnd === 'rejected'
                    ? `${oppName} rejected.`
                    : 'Offered: both players must agree.'
                  : 'Both players must agree to stop.'}
              </Text>
            </Pressable>
          )}
          <Button label="Close" onPress={closeMenu} />
        </>
      );
    }
    // follow-up choices of one promise
    const others = othersOf(menuFor);
    return (
      <>
        <Text style={styles.menuTitle}>{promiseTitle(view, menuFor)}</Text>
        <Text style={styles.small}>Choose what happens to you next round (you can pick one or both).</Text>
        <Radio on={fa} mark={['☑', '☐']} text={followA(view, menuFor)} onPress={() => setFa(!fa)} />
        <Radio
          on={fb}
          mark={['☑', '☐']}
          text={followB(view, menuFor, fb ? fset : null)}
          onPress={() => {
            setFb(!fb);
            setFset(null);
          }}
        />
        {fb && (
          <View style={styles.sect}>
            <Text style={styles.notesWho}>If I lied, I am disabled to pick:</Text>
            {([...others, 'both'] as SetChoice[]).map((c) => (
              <Radio key={c} on={fset === c} mark={['◉', '○']} text={c === 'both' ? `BOTH (${setLabel(menuFor, 'both')})` : THROW_LABEL[c as Throw]} onPress={() => setFset(c)} />
            ))}
          </View>
        )}
        <Button
          label="Make my promise"
          disabled={fb && !fset}
          onPress={() => {
            makePromise(promiseCode(view, menuFor, fa, fb ? fset : null));
            setView(null);
          }}
        />
        <Button label="Back" variant="secondary" onPress={() => setView(null)} />
      </>
    );
  };

  const seconds = Math.ceil(left / 1000);
  const choosing = (phase === 'pick' || phase === 'negotiate' || phase === 'final') && !!opp;

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Text style={styles.small}>
          Round {k}/{MAX_ROUNDS} · You {(now.score[uid] ?? 0) > 0 ? '+' : ''}
          {now.score[uid] ?? 0} pts
        </Text>
        <Text style={styles.phase}>
          {phase === 'pick'
            ? 'Pick your INITIAL throw'
            : phase === 'negotiate'
              ? 'Negotiation'
              : phase === 'final'
                ? 'FINAL throw'
                : phase === 'wait'
                  ? 'Revealing…'
                  : phase === 'reveal'
                    ? 'Reveal'
                    : 'Match over'}
        </Text>
      </View>

      {/* Notes: upper right, just under the phase text. Tap to open or close. */}
      {noteCount > 0 && (
        <View style={styles.notesAnchor} pointerEvents="box-none">
          <Pressable
            onPress={() => setNotesOpen((o) => !o)}
            style={[styles.notesPill, hasNew && styles.notesPillNew]}
            accessibilityRole="button"
          >
            <Text style={[styles.notesPillText, hasNew && { color: colors.bg }]}>
              {hasNew ? `● ${oppName} says something · ` : ''}Notes ({noteCount}) {notesOpen ? '▴' : '▾'}
            </Text>
          </Pressable>
          {notesOpen && (
            <ScrollView style={styles.notesPanel} nestedScrollEnabled>
              {mineNotes.length > 0 && (
                <>
                  <Text style={styles.notesWho}>Rules for you</Text>
                  {mineNotes.map((t, j) => (
                    <Text key={`m${j}`} style={styles.notesLine}>
                      • {t}
                    </Text>
                  ))}
                </>
              )}
              {myPromiseLines.length > 0 && (
                <>
                  <Text style={[styles.notesWho, { marginTop: 8 }]}>You promised</Text>
                  {myPromiseLines.map((t, j) => (
                    <Text key={`p${j}`} style={styles.notesLine}>
                      {j === 0 ? '' : '• '}
                      {t}
                    </Text>
                  ))}
                </>
              )}
              {(theirPromiseLines.length > 0 || theirEnd) && (
                <>
                  <Text style={[styles.notesWho, { marginTop: 8 }]}>{oppName}</Text>
                  {theirPromiseLines.map((t, j) => (
                    <Text key={`o${j}`} style={styles.notesLine}>
                      {j === 0 ? '' : '• '}
                      {t}
                    </Text>
                  ))}
                  {theirEnd && (
                    <Text style={styles.notesLine}>
                      • Wants to end the match after this round
                      {theirEndStatus === 'agreed' ? ' [AGREED]' : mine.rej.includes(END_CODE) ? ' [you rejected]' : ''}.
                    </Text>
                  )}
                </>
              )}
              {showOpp && mine.offers.includes(END_CODE) && (
                <Text style={[styles.notesLine, { marginTop: 8 }]}>
                  • You offered to end the match after this round [{myEnd === 'agreed' ? 'AGREED' : myEnd === 'rejected' ? 'rejected' : 'waiting for an answer'}].
                </Text>
              )}
            </ScrollView>
          )}
        </View>
      )}

      <View style={{ width: size, height: size + 10, alignSelf: 'center' }}>
        <View style={[styles.hub, { left: center - 55, top: center - 45 }]}>
          {phase === 'pick' || phase === 'negotiate' || phase === 'final' ? (
            <>
              <Text style={styles.timer}>{seconds}</Text>
              <Text style={styles.small}>{phase === 'pick' ? 'to commit' : phase === 'final' ? 'to lock final' : 'seconds left'}</Text>
            </>
          ) : phase === 'done' ? (
            <Text style={styles.small}>Waiting for the other players…</Text>
          ) : (
            <Text style={styles.small}>{opp ? `vs ${oppName}` : 'Bye'}</Text>
          )}
        </View>
        {order.map((p, i) => (
          <Box key={p} p={p} i={i} />
        ))}
      </View>

      {reveal && opp && (() => {
        const l = lineOf(uid);
        const text = !l
          ? `${oppName} did not reveal a throw. No points this round.`
          : l.winner === null
            ? `Draw: ${THROW_LABEL[l.a === uid ? l.ta : l.tb]} vs ${THROW_LABEL[l.a === uid ? l.tb : l.ta]}.`
            : `${l.winner === uid ? 'You win' : 'You lose'} 1 point: ${THROW_LABEL[l.a === uid ? l.ta : l.tb]} vs ${THROW_LABEL[l.a === uid ? l.tb : l.ta]}.`;
        return (
          <>
            <Text style={styles.result}>{text}</Text>
            {l?.effects.map((e, j) => (
              <Text key={j} style={styles.small}>
                {nameOf(e.uid)} {e.text}.
              </Text>
            ))}
          </>
        );
      })()}

      {choosing && (
        <>
          <Text style={styles.small}>
            {phase === 'pick'
              ? 'Commit your INITIAL throw. Everyone can see it, and you can change it during the negotiation.'
              : phase === 'negotiate'
                ? 'Tap to change your public INITIAL throw. Long-press a throw to make a promise.'
                : 'Pick your real FINAL throw now. Others still see your initial throw until the reveal.'}
          </Text>
          <View style={styles.rowBtns}>
            {THROWS.map((t) => {
              const ok = allowed.includes(t);
              const picked = phase === 'final' ? final === t : mine.initial === t;
              return (
                <Pressable
                  key={t}
                  disabled={!ok && phase !== 'negotiate'}
                  onPress={() => choose(t)}
                  onLongPress={() => {
                    if (negotiating) {
                      setMenuFor(t);
                      setView(null);
                    }
                  }}
                  style={[styles.throwBtn, picked && styles.throwBtnOn, !ok && { opacity: 0.3 }]}
                >
                  <Text style={styles.throwIcon}>{THROW_ICON[t]}</Text>
                  <Text style={styles.throwLabel}>{THROW_LABEL[t]}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {/* Negotiation dialog: opens in the middle of the screen on a long-press */}
      <Modal visible={!!menuFor && negotiating} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.backdrop} onPress={closeMenu}>
          <Pressable style={styles.dialog} onPress={() => {}}>
            <ScrollView contentContainerStyle={{ gap: 8 }}>{renderMenu()}</ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {phase === 'done' && (
        <Text style={styles.result}>
          Your total: {(now.score[uid] ?? 0) > 0 ? '+' : ''}
          {now.score[uid] ?? 0} points.
        </Text>
      )}
      {room && !room.janken && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Sharing is switched off in this build.</Text>
          <Text style={styles.errorText}>
            GameScreen.tsx and types.ts are not the updated versions (no room.janken), so nobody sees anybody else's
            throw or promise. Replace them, then restart the app.
          </Text>
        </View>
      )}
      {sendError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>The other players are NOT receiving your throw and promise.</Text>
          <Text style={styles.errorText}>
            Error: {sendError}.{' '}
            {sendError === 'permission-denied'
              ? 'The Firestore rules in your project are out of date: deploy backend/firestore.rules (firebase deploy --only firestore:rules), then tap Send again.'
              : 'Check your connection, then tap Send again.'}
          </Text>
          <Button
            label="Send again"
            variant="secondary"
            onPress={() => {
              if (lastSent.current) save(lastSent.current);
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 8, gap: 10 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  small: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  phase: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  notesAnchor: { position: 'absolute', top: 30, right: 8, zIndex: 20, alignItems: 'flex-end' },
  notesPill: {
    backgroundColor: colors.cardAlt,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  notesPillNew: { backgroundColor: colors.accent },
  notesPillText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  notesPanel: {
    marginTop: 6,
    width: 280,
    maxWidth: '100%',
    maxHeight: 320,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 10,
  },
  notesWho: { color: colors.text, fontSize: 12, fontWeight: '800' },
  notesLine: { color: colors.muted, fontSize: 12 },
  sect: { gap: 4, backgroundColor: colors.card, borderRadius: radius.md, padding: 8 },
  hub: { position: 'absolute', width: 110, height: 90, alignItems: 'center', justifyContent: 'center' },
  timer: { color: colors.text, fontSize: 48, fontWeight: '800' },
  box: { position: 'absolute', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: 6, gap: 1 },
  boxMe: { borderColor: colors.accent },
  boxOpp: { borderColor: colors.danger },
  boxName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  tag: { color: colors.muted, fontSize: 8, fontWeight: '700', marginTop: 2 },
  throwText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  hidden: { color: colors.muted, fontSize: 11, fontStyle: 'italic' },
  revealed: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  result: { color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  rowBtns: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  flex: { flex: 1 },
  throwBtn: { flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  throwBtnOn: { borderColor: colors.accent, backgroundColor: colors.cardAlt },
  throwIcon: { fontSize: 28 },
  throwLabel: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 2 },
  errorBox: { backgroundColor: colors.cardAlt, borderColor: colors.danger, borderWidth: 2, borderRadius: radius.md, padding: 10, gap: 6 },
  errorTitle: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  errorText: { color: colors.text, fontSize: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  dialog: { width: '100%', maxWidth: 400, maxHeight: '88%', backgroundColor: colors.cardAlt, borderColor: colors.accent, borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  menuTitle: { color: colors.accent, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  kindBtn: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 2 },
  kindTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  kindBlurb: { color: colors.muted, fontSize: 12 },
  radio: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: 10 },
  radioOn: { borderColor: colors.accent },
  radioMark: { color: colors.accent, fontSize: 16 },
  radioText: { color: colors.text, fontSize: 13, flex: 1 },
});