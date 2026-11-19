import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from '../components/ui';
import {
  allowedThrows,
  dealOf,
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
//   pick INITIAL throw (8 s) -> negotiate (30 s, FINAL throw can change any time) -> everybody's
//   final throw is revealed at once -> next round, until the pair agrees to end the match.
// Only the player's own screen shows their initial and final throw. What an opponent sees of you is
// a few short notes: your promise (not binding: betrayal is allowed), and the offers you made.
// Long-press ROCK / PAPER / SCISSORS to open the negotiation actions for that selection.

type Phase = 'pick' | 'negotiate' | 'wait' | 'reveal' | 'done';
const BOT = 'bot';
const pickOne = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

const dealText = (d: Deal, what: string, other: string) => {
  switch (d) {
    case 'agreed':
      return null; // each caller words the accepted case itself
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

export function JankenNegotiationGame({ seed, uid, onFinish, room }: GameProps) {
  const { width } = useWindowDimensions();
  const practice = !room;
  const players = room ? room.playerIds : [uid, BOT];
  const out = room ? room.out : [];
  const names: Record<string, string> = room ? room.usernames : { [BOT]: 'Hatter Bot' };
  const nameOf = (p: string) => (p === uid ? 'You' : names[p] ?? 'Player');

  const [k, setK] = useState(1);
  const [phase, setPhase] = useState<Phase>('pick');
  const [initial, setInitial] = useState<Throw | null>(null);
  const [final, setFinal] = useState<Throw | null>(null);
  const [mine, setMine] = useState<{ dbl: Offer; term: Offer; promise: '' | Throw }>({ dbl: '', term: '', promise: '' });
  const [menuFor, setMenuFor] = useState<Throw | null>(null);
  const [left, setLeft] = useState(INITIAL_MS);
  const [sendFailed, setSendFailed] = useState(false);
  const [local, setLocal] = useState<JankenDoc[]>([]); // practice run: my docs and the bot's

  const docs: JankenDoc[] = room ? room.janken?.docs ?? [] : local;
  const docsRef = useRef(docs);
  docsRef.current = docs;
  const initialRef = useRef<Throw | null>(null);
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

  // ---- publish my notes/offers for this round (the throw stays hidden until the reveal)
  const save = (doc: JankenDoc) => {
    lastSent.current = doc;
    if (room?.janken) {
      room.janken.save(doc.k, { dbl: doc.dbl, term: doc.term, promise: doc.promise, throw: doc.throw }).catch(() => setSendFailed(true));
    } else {
      setLocal((d) => [...d.filter((x) => !(x.uid === doc.uid && x.k === doc.k)), doc]);
    }
  };
  const publish = (patch: Partial<typeof mine>) => {
    const next = { ...mineRef.current, ...patch };
    mineRef.current = next;
    setMine(next);
    if (opp) save({ uid, k, ...next, throw: '' });
  };

  const choose = (t: Throw) => {
    if (!allowed.includes(t) || !opp) return;
    if (phase === 'pick') {
      initialRef.current = t;
      setInitial(t);
      finalRef.current = t;
      setFinal(t);
    } else if (phase === 'negotiate') {
      finalRef.current = t; // the latest valid selection before the timer ends is the FINAL throw
      setFinal(t);
    }
  };

  // ---- phase timers
  useEffect(() => {
    phaseStart.current = Date.now();
    if (phase === 'pick') {
      setLeft(INITIAL_MS);
      const tick = setInterval(() => setLeft(Math.max(0, phaseStart.current + INITIAL_MS - Date.now())), 200);
      const stop = setTimeout(() => {
        if (opp && !initialRef.current) {
          const t = pickOne(allowed); // never committed: a random allowed throw is committed for you
          initialRef.current = t;
          setInitial(t);
          finalRef.current = t;
          setFinal(t);
        }
        setPhase('negotiate');
      }, INITIAL_MS);
      return () => {
        clearInterval(tick);
        clearTimeout(stop);
      };
    }
    if (phase === 'negotiate') {
      setLeft(NEGOTIATION_MS);
      const tick = setInterval(() => setLeft(Math.max(0, phaseStart.current + NEGOTIATION_MS - Date.now())), 200);
      const stop = setTimeout(() => {
        setMenuFor(null);
        if (opp) {
          const t = finalRef.current && allowed.includes(finalRef.current) ? finalRef.current : pickOne(allowed);
          finalRef.current = t;
          setFinal(t);
          save({ uid, k, ...mineRef.current, throw: t }); // the reveal
        }
        setPhase('wait');
      }, NEGOTIATION_MS);
      return () => {
        clearInterval(tick);
        clearTimeout(stop);
      };
    }
    if (phase === 'wait') {
      // Show the reveal once every pair's throws are in (or after a grace period: that player no-showed).
      const check = setInterval(() => {
        const r = replay(seed, players, out, docsRef.current, k).rounds[k - 1];
        const need = r.pairs.flat();
        const missing = need.filter((p) => !docsRef.current.some((d) => d.uid === p && d.k === k && d.throw));
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
        initialRef.current = null;
        finalRef.current = null;
        setInitial(null);
        setFinal(null);
        const fresh = { dbl: '' as Offer, term: '' as Offer, promise: '' as '' | Throw };
        mineRef.current = fresh;
        setMine(fresh);
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
    const base: JankenDoc = cur ?? { uid: BOT, k, dbl: '', term: '', promise: pickOne(THROWS), throw: '' };
    const myTerm = mine.term;
    const next: JankenDoc = {
      ...base,
      dbl: mine.dbl === 'yes' ? (botPlan.current.dbl ? 'yes' : 'no') : base.dbl,
      term: myTerm === 'yes' ? (k >= 3 ? 'yes' : 'no') : base.term,
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
      return d.map((x) => (x === cur ? { ...cur, throw: pickOne(allowedThrows(botPrev)) } : x));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice, phase, k]);

  // ------------------------------------------------------------------ notes in the boxes
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

  // ------------------------------------------------------------------ circle of players
  const size = Math.min(width - 24, 400);
  const boxW = 98;
  const radiusPx = (size - boxW) / 2;
  const alive = players.filter((p) => !out.includes(p));
  const order = [uid, ...alive.filter((p) => p !== uid)]; // I am at the bottom of the circle
  const center = size / 2;

  const reveal = phase === 'reveal' || phase === 'done';
  const lineOf = (p: string) => now.lines.find((l) => l.k === k && (l.a === p || l.b === p));

  const Box = ({ p, i }: { p: string; i: number }) => {
    const angle = Math.PI / 2 + (2 * Math.PI * i) / order.length; // i = 0 is at the bottom
    const x = center + radiusPx * Math.cos(angle) - boxW / 2;
    const y = center + radiusPx * Math.sin(angle) - 46;
    const isMe = p === uid;
    const pair = round?.pairs.find(([a, b]) => a === p || b === p);
    const partner = pair ? (pair[0] === p ? pair[1] : pair[0]) : null;
    const line = lineOf(p);
    const shown = line ? (line.a === p ? line.ta : line.tb) : null;
    const gone = before.left.includes(p);
    const notes = isMe ? ownNotes() : p === opp ? oppNotes() : [];
    const heading = p === opp ? styles.boxOpp : isMe ? styles.boxMe : null;
    return (
      <View style={[styles.box, { left: x, top: y, width: boxW }, heading, gone && { opacity: 0.45 }]}>
        <Text style={styles.boxName} numberOfLines={1}>
          {nameOf(p)}
        </Text>
        <Text style={styles.boxScore}>{(now.score[p] ?? 0) > 0 ? '+' : ''}{now.score[p] ?? 0} pts</Text>
        {isMe && opp && (phase === 'pick' || phase === 'negotiate') && (
          <>
            <Text style={styles.tag}>INITIAL THROW</Text>
            <Text style={styles.throwText}>{initial ? `${THROW_ICON[initial]} ${THROW_LABEL[initial]}` : '—'}</Text>
            <Text style={styles.tag}>FINAL THROW</Text>
            <Text style={styles.throwText}>{final ? `${THROW_ICON[final]} ${THROW_LABEL[final]}` : '—'}</Text>
          </>
        )}
        {!isMe && !reveal && partner && <Text style={styles.hidden}>Throws hidden</Text>}
        {reveal && shown && <Text style={styles.revealed}>{THROW_ICON[shown]} {THROW_LABEL[shown]}</Text>}
        {gone ? (
          <Text style={styles.note}>Left the match.</Text>
        ) : !isMe && p !== opp ? (
          <Text style={styles.note}>{partner ? `vs ${nameOf(partner)}` : 'Bye'}</Text>
        ) : null}
        {notes.map((t, j) => (
          <Text key={j} style={styles.note}>
            {t}
          </Text>
        ))}
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

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Text style={styles.small}>
          Round {k}/{MAX_ROUNDS}
        </Text>
        <Text style={styles.phase}>
          {phase === 'pick' ? 'Pick your INITIAL throw' : phase === 'negotiate' ? 'Negotiation' : phase === 'wait' ? 'Revealing…' : phase === 'reveal' ? 'Reveal' : 'Match over'}
        </Text>
      </View>

      <View style={{ width: size, height: size + 20, alignSelf: 'center' }}>
        <View style={[styles.hub, { left: center - 60, top: center - 52 }]}>
          {phase === 'pick' || phase === 'negotiate' ? (
            <>
              <Text style={styles.timer}>{seconds}</Text>
              <Text style={styles.small}>{phase === 'pick' ? 'to commit' : 'seconds left'}</Text>
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

      {(phase === 'pick' || phase === 'negotiate') && opp && (
        <>
          <Text style={styles.small}>
            {phase === 'pick'
              ? 'Commit a throw. It stays hidden from everybody.'
              : 'Tap to change your FINAL throw. Long-press a throw for negotiation actions.'}
          </Text>
          <View style={styles.rowBtns}>
            {THROWS.map((t) => {
              const ok = allowed.includes(t);
              const picked = phase === 'pick' ? initial === t : final === t;
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
      {sendFailed && (
        <Button
          label="Send again"
          variant="secondary"
          onPress={() => {
            setSendFailed(false);
            if (lastSent.current) save(lastSent.current);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 8, gap: 10 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  small: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  phase: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  hub: { position: 'absolute', width: 120, height: 104, alignItems: 'center', justifyContent: 'center' },
  timer: { color: colors.text, fontSize: 52, fontWeight: '800' },
  box: { position: 'absolute', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: 6, gap: 1 },
  boxMe: { borderColor: colors.accent },
  boxOpp: { borderColor: colors.danger },
  boxName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  boxScore: { color: colors.muted, fontSize: 11 },
  tag: { color: colors.muted, fontSize: 8, fontWeight: '700', marginTop: 2 },
  throwText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  hidden: { color: colors.muted, fontSize: 10, fontStyle: 'italic' },
  revealed: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  note: { color: colors.muted, fontSize: 9, marginTop: 1 },
  result: { color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  rowBtns: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  flex: { flex: 1 },
  throwBtn: { flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  throwBtnOn: { borderColor: colors.accent, backgroundColor: colors.cardAlt },
  throwIcon: { fontSize: 28 },
  throwLabel: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 2 },
  menu: { backgroundColor: colors.cardAlt, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 12, gap: 8 },
  menuTitle: { color: colors.accent, fontSize: 14, fontWeight: '700', textAlign: 'center' },
});