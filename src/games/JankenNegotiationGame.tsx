import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from '../components/ui';
import {
  allowedThrows,
  dealOf,
  FINAL_MS,
  INITIAL_MS,
  MAX_ROUNDS,
  NEGOTIATION_MS,
  replay,
  REVEAL_MS,
  SCORE_OFFSET,
  THROW_ICON,
  THROW_LABEL,
  THROWS,
  WAIT_REVEAL_MS,
} from '../game/janken';
import type { Deal, JankenDoc, Offer, Throw } from '../game/janken';
import { colors, radius } from '../theme';
import type { GameProps } from './types';

// Janken Negotiation. Every round (all rules are in src/game/janken.ts):
//   1. pick an INITIAL throw (8 s)
//   2. negotiate (30 s): the INITIAL throw is PUBLIC (everybody sees it) and can be changed any time
//   3. FINAL throw (last 5 s): pick the FINAL throw in private; it can differ from the initial one
//   4. everybody's final throw is revealed at once
// Long-press ROCK / PAPER / SCISSORS during the negotiation to open the negotiation actions.
// All the notes (own and the opponent's) are in one collapsible panel under the phase text.

type Phase = 'pick' | 'negotiate' | 'final' | 'wait' | 'reveal' | 'done';
const BOT = 'bot';
const pickOne = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

const dealText = (d: Deal, what: string, other: string) => {
  switch (d) {
    case 'mine':
      return `You offered ${what}. Waiting for ${other}.`;
    case 'theirs':
      return `${other} offers ${what}.`;
    case 'rejected-by-them':
      return `${other} rejected ${what}.`;
    case 'rejected-by-me':
      return `You rejected ${what}.`;
    default:
      return null;
  }
};

type Mine = { dbl: Offer; term: Offer; promise: '' | Throw; initial: '' | Throw };
const EMPTY: Mine = { dbl: '', term: '', promise: '', initial: '' };

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
  const [notesOpen, setNotesOpen] = useState(false);
  const [left, setLeft] = useState(INITIAL_MS);
  const [sendError, setSendError] = useState<string | null>(null); // why sharing with the others failed
  const [seenNotes, setSeenNotes] = useState('');
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
  const botPlan = useRef({ dbl: false });
  const lastSent = useRef<JankenDoc | null>(null);

  // ---- who plays whom this round, and the score so far
  const before = replay(seed, players, out, docs, k - 1);
  const now = replay(seed, players, out, docs, k);
  const round = now.rounds[k - 1];
  const myPair = round?.pairs.find(([a, b]) => a === uid || b === uid);
  const opp = myPair ? (myPair[0] === uid ? myPair[1] : myPair[0]) : null;
  const prevThrow = before.prev[uid] ?? null;
  const allowed = allowedThrows(prevThrow);
  const docOf = (p: string) => docs.find((d) => d.uid === p && d.k === k);
  const oppDoc = opp ? docOf(opp) : undefined;
  const dblDeal = dealOf(mine.dbl, oppDoc?.dbl ?? '');
  const termDeal = dealOf(mine.term, oppDoc?.term ?? '');
  const oppName = opp ? nameOf(opp) : '';

  // ---- publish my initial throw / notes / offers (the FINAL throw stays hidden until the reveal)
  const save = (doc: JankenDoc) => {
    lastSent.current = doc;
    if (room?.janken) {
      room.janken
        .save(doc.k, { dbl: doc.dbl, term: doc.term, promise: doc.promise, initial: doc.initial, throw: doc.throw })
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
    if (!allowed.includes(t) || !opp) return;
    if (phase === 'pick' || phase === 'negotiate') {
      publish({ initial: t }); // the INITIAL throw: public, can change until the final phase
    } else if (phase === 'final') {
      finalRef.current = t; // the latest valid selection before the time is up is the FINAL throw
      setFinal(t);
    }
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
        if (opp && !mineRef.current.initial) publish({ initial: pickOne(allowed) }); // never committed: random
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
        setMenuFor(null);
        // Final-throw phase starts with the initial throw selected; change it if you want.
        const init = mineRef.current.initial;
        const start = init && allowed.includes(init) ? init : null;
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
          const t = finalRef.current && allowed.includes(finalRef.current) ? finalRef.current : pickOne(allowed);
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
        setMenuFor(null);
        botPlan.current = { dbl: Math.random() < 0.5 };
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

  // ---- practice run: a simple bot opponent
  useEffect(() => {
    if (!practice || !opp || (phase !== 'negotiate' && phase !== 'pick')) return;
    const cur = local.find((d) => d.uid === BOT && d.k === k);
    const botPrev = before.prev[BOT] ?? null;
    const base: JankenDoc =
      cur ?? { uid: BOT, k, dbl: '', term: '', promise: pickOne(THROWS), initial: pickOne(allowedThrows(botPrev)), throw: '' };
    const next: JankenDoc = {
      ...base,
      dbl: mine.dbl === 'yes' ? (botPlan.current.dbl ? 'yes' : 'no') : base.dbl,
      term: mine.term === 'yes' ? (k >= 3 ? 'yes' : 'no') : base.term,
    };
    if (!cur || next.dbl !== cur.dbl || next.term !== cur.term) {
      setLocal((d) => [...d.filter((x) => !(x.uid === BOT && x.k === k)), next]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice, phase, k, mine.dbl, mine.term]);

  useEffect(() => {
    if (!practice || phase !== 'wait') return;
    setLocal((d) => {
      const cur = d.find((x) => x.uid === BOT && x.k === k);
      if (!cur || cur.throw) return d;
      const botPrev = replay(seed, players, out, d, k - 1).prev[BOT] ?? null;
      const ok = allowedThrows(botPrev);
      // The bot usually keeps its initial throw, but sometimes switches (it can bluff too).
      const t = cur.initial && ok.includes(cur.initial) && Math.random() < 0.7 ? cur.initial : pickOne(ok);
      return d.map((x) => (x === cur ? { ...cur, throw: t } : x));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice, phase, k]);

  // ------------------------------------------------------------------ notes (one panel)
  const ownNotes = (): string[] => {
    const n: string[] = [];
    if (!opp && phase !== 'done') n.push('Bye this round: nobody to play.');
    if (prevThrow) {
      n.push(`Previous Throw: ${THROW_LABEL[prevThrow]}.`);
      n.push(`Forced Rotation: ${allowed.map((t) => THROW_LABEL[t]).join(' / ')} only.`);
    }
    if (opp) {
      if (dblDeal === 'agreed') n.push('Double or Nothing: Accepted (2× Stakes).');
      else {
        const t = dealText(dblDeal, 'Double or Nothing', oppName);
        if (t) n.push(t);
      }
      if (termDeal === 'agreed') n.push('Negotiation Agreement: Agreed to terminate after this round.');
      else {
        const t = dealText(termDeal, 'to end the match after this round', oppName);
        if (t) n.push(t);
      }
      if (mine.promise) n.push(`You promised ${THROW_LABEL[mine.promise]} (not binding).`);
      if (phase === 'final') n.push('Initial Throw locked. Pick your Final Throw.');
      if (phase === 'wait' || phase === 'reveal') n.push('Current Status: Final Throw Locked.');
    }
    return n;
  };

  const oppNotes = (): string[] => {
    const n: string[] = [];
    if (!oppDoc) return n;
    if (oppDoc.promise) n.push(`Promises ${THROW_LABEL[oppDoc.promise]}.`);
    if (dblDeal === 'agreed') n.push('Double or Nothing: Accepted (2× Stakes).');
    else if (dblDeal === 'theirs') n.push('Offers Double or Nothing.');
    else if (dblDeal === 'rejected-by-them') n.push('Rejected Double or Nothing.');
    if (termDeal === 'agreed') n.push('Agreed to terminate after this round.');
    else if (termDeal === 'theirs') n.push('Wants to end the match after this round.');
    else if (termDeal === 'rejected-by-them') n.push('Rejected ending the match.');
    return n;
  };

  const mineNotes = phase === 'done' ? [] : ownNotes();
  const theirNotes = phase === 'done' ? [] : oppNotes();
  const noteCount = mineNotes.length + theirNotes.length;
  // The opponent's notes (promise, offers) light the pill up until you open the panel.
  const theirSig = theirNotes.join('|');
  const hasNew = theirNotes.length > 0 && theirSig !== seenNotes;
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
    const y = center + radiusPx * Math.sin(angle) - 36;
    const isMe = p === uid;
    const pair = round?.pairs.find(([a, b]) => a === p || b === p);
    const partner = pair ? (pair[0] === p ? pair[1] : pair[0]) : null;
    const line = lineOf(p);
    const shownFinal = line ? (line.a === p ? line.ta : line.tb) : null;
    const gone = before.left.includes(p);
    // The INITIAL throw is public: everybody sees it. The FINAL throw is only yours until the reveal.
    const initialOf: '' | Throw = isMe ? mine.initial : docOf(p)?.initial ?? '';
    const border = p === opp ? styles.boxOpp : isMe ? styles.boxMe : null;
    return (
      <View style={[styles.box, { left: x, top: y, width: boxW }, border, gone && { opacity: 0.45 }]}>
        <Text style={styles.boxName} numberOfLines={1}>
          {nameOf(p)}
        </Text>
        <Text style={styles.boxScore}>
          {(now.score[p] ?? 0) > 0 ? '+' : ''}
          {now.score[p] ?? 0} pts{partner ? ` · vs ${nameOf(partner)}` : gone ? ' · left' : ' · bye'}
        </Text>
        {!gone && partner && (
          <>
            <Text style={styles.tag}>INITIAL THROW</Text>
            <Text style={styles.throwText}>
              {initialOf ? `${THROW_ICON[initialOf]} ${THROW_LABEL[initialOf]}` : isMe ? '—' : 'waiting…'}
            </Text>
            <Text style={styles.tag}>FINAL THROW</Text>
            {reveal && shownFinal ? (
              <Text style={styles.revealed}>
                {THROW_ICON[shownFinal]} {THROW_LABEL[shownFinal]}
              </Text>
            ) : isMe ? (
              <Text style={styles.throwText}>
                {phase === 'final' && final ? `${THROW_ICON[final]} ${THROW_LABEL[final]}` : phase === 'wait' && final ? '🔒 locked' : '—'}
              </Text>
            ) : (
              <Text style={styles.hidden}>hidden</Text>
            )}
          </>
        )}
      </View>
    );
  };

  // ------------------------------------------------------------------ negotiation menu
  const OfferRow = ({ what, deal, field }: { what: string; deal: Deal; field: 'dbl' | 'term' }) => {
    if (deal === 'agreed' || deal === 'rejected-by-them') return null;
    if (deal === 'mine') return <Button label={`Withdraw: ${what}`} variant="secondary" onPress={() => publish({ [field]: '' })} />;
    if (deal === 'theirs' || deal === 'rejected-by-me') {
      return (
        <View style={styles.rowBtns}>
          <Button label={`Accept ${what}`} onPress={() => publish({ [field]: 'yes' })} style={styles.flex} />
          {deal === 'theirs' && <Button label="Reject" variant="secondary" onPress={() => publish({ [field]: 'no' })} style={styles.flex} />}
        </View>
      );
    }
    return <Button label={`Offer ${what}`} variant="secondary" onPress={() => publish({ [field]: 'yes' })} />;
  };

  const canNegotiate = phase === 'negotiate' && !!opp;
  const seconds = Math.ceil(left / 1000);
  const choosing = (phase === 'pick' || phase === 'negotiate' || phase === 'final') && !!opp;

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Text style={styles.small}>
          Round {k}/{MAX_ROUNDS}
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

      {/* Notes: upper right, just under the phase text. Tap to open or close. Everything said by
          each player is combined here. Drawn over the circle so it never pushes the layout. */}
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
            <View style={styles.notesPanel}>
              {mineNotes.length > 0 && (
                <>
                  <Text style={styles.notesWho}>You</Text>
                  {mineNotes.map((t, j) => (
                    <Text key={`m${j}`} style={styles.notesLine}>
                      • {t}
                    </Text>
                  ))}
                </>
              )}
              {theirNotes.length > 0 && (
                <>
                  <Text style={[styles.notesWho, mineNotes.length > 0 && { marginTop: 8 }]}>{oppName}</Text>
                  {theirNotes.map((t, j) => (
                    <Text key={`o${j}`} style={styles.notesLine}>
                      • {t}
                    </Text>
                  ))}
                </>
              )}
            </View>
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
            : `${l.winner === uid ? 'You win' : 'You lose'} ${l.stake} point${l.stake > 1 ? 's' : ''}: ${THROW_LABEL[l.a === uid ? l.ta : l.tb]} vs ${THROW_LABEL[l.a === uid ? l.tb : l.ta]}.`;
        return <Text style={styles.result}>{text}</Text>;
      })()}

      {choosing && (
        <>
          <Text style={styles.small}>
            {phase === 'pick'
              ? 'Commit your INITIAL throw. Everyone can see it, and you can change it during the negotiation.'
              : phase === 'negotiate'
                ? 'Tap to change your public INITIAL throw. Long-press a throw for negotiation actions.'
                : 'Pick your FINAL throw now. Only you can see it until the reveal.'}
          </Text>
          <View style={styles.rowBtns}>
            {THROWS.map((t) => {
              const ok = allowed.includes(t);
              const picked = phase === 'final' ? final === t : mine.initial === t;
              return (
                <Pressable
                  key={t}
                  disabled={!ok}
                  onPress={() => choose(t)}
                  onLongPress={() => canNegotiate && setMenuFor(menuFor === t ? null : t)}
                  style={[styles.throwBtn, picked && styles.throwBtnOn, !ok && { opacity: 0.3 }]}
                >
                  <Text style={styles.throwIcon}>{THROW_ICON[t]}</Text>
                  <Text style={styles.throwLabel}>{THROW_LABEL[t]}</Text>
                </Pressable>
              );
            })}
          </View>
          {menuFor && canNegotiate && (
            <View style={styles.menu}>
              <Text style={styles.menuTitle}>{THROW_LABEL[menuFor]} · negotiation actions</Text>
              <Button
                label={mine.promise === menuFor ? `Take back promise` : `Promise ${THROW_LABEL[menuFor]} (not binding)`}
                variant="secondary"
                onPress={() => publish({ promise: mine.promise === menuFor ? '' : menuFor })}
              />
              <OfferRow what="Double or Nothing" deal={dblDeal} field="dbl" />
              <OfferRow what="ending the match" deal={termDeal} field="term" />
              <Text style={styles.small}>Promises are only notes: you can still betray them. Offers need both players to agree.</Text>
            </View>
          )}
        </>
      )}

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
            throw or notes. Replace them, then restart the app.
          </Text>
        </View>
      )}
      {sendError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>The other players are NOT receiving your throw and notes.</Text>
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
  // Notes: sits right under the phase text (top right) and floats over the circle.
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
    width: 250,
    maxWidth: '100%',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 10,
    gap: 3,
  },
  notesWho: { color: colors.text, fontSize: 12, fontWeight: '800' },
  notesLine: { color: colors.muted, fontSize: 12 },
  hub: { position: 'absolute', width: 110, height: 90, alignItems: 'center', justifyContent: 'center' },
  timer: { color: colors.text, fontSize: 48, fontWeight: '800' },
  box: { position: 'absolute', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: 6, gap: 1 },
  boxMe: { borderColor: colors.accent },
  boxOpp: { borderColor: colors.danger },
  boxName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  boxScore: { color: colors.muted, fontSize: 9 },
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
  menu: { backgroundColor: colors.cardAlt, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 12, gap: 8 },
  errorBox: { backgroundColor: colors.cardAlt, borderColor: colors.danger, borderWidth: 2, borderRadius: radius.md, padding: 10, gap: 6 },
  errorTitle: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  errorText: { color: colors.text, fontSize: 12 },
  menuTitle: { color: colors.accent, fontSize: 14, fontWeight: '700', textAlign: 'center' },
});