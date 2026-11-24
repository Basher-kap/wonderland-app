import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { fmt, LOSE_AT, MAX_NUMBER, RULE_TEXT } from '../game/beautyContest';
import type { Reveal, Row, RuleId } from '../game/beautyContest';
import type { Timeline } from '../game/beautyReveal';
import { royal as c, FONT_ROYAL } from '../gameThemes/beautyContest';

// Beauty Contest: the screens of a round, one at a time (BeautyContestGame.tsx decides which):
//   1. PickPad      the number pad (with the special rules in force as a banner under it)
//      LockedWait   after LOCK: your number and who has locked in; the pad is hidden
//   2. NumbersStage the contestants with their numbers, then the calculation bit by bit, then the winner
//   3. ScoresStage  the contestants again with the points they lost; "game over" and the new rule
//   4. OverStage    the end of the game
// The reveal screens are driven by `elapsed` (ms since the reveal started) and the Timeline of
// game/beautyReveal.ts, so every phone shows the same step at the same moment.

export type PadKey = number | 'back' | 'lock';
export const KEYS: PadKey[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  ['back', 0, 'lock'],
];

export type Names = { uid: string; who: (id: string) => string };

// Fades and slides up once, when it first appears (no motion with reduce-motion).
export function Appear({ children, still, style }: { children: React.ReactNode; still: boolean; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(still ? 1 : 0)).current;
  useEffect(() => {
    if (still) return;
    Animated.timing(v, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [still, v]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// -------------------------------------------------- 1. choosing a number ----
export function PickPad(props: {
  draft: string;
  lockedVal: number | null;
  secondsLeft: number;
  hot: boolean;
  onKey: (k: PadKey) => void;
}) {
  const { draft, lockedVal, secondsLeft, hot, onKey } = props;
  return (
    <View style={styles.console}>
      <View style={styles.clockRow}>
        <Text style={styles.consoleTitle}>Choose your number</Text>
        <Text style={[styles.clock, hot && { color: c.hot }]} accessibilityLabel={`${secondsLeft} seconds left`}>
          {secondsLeft}
        </Text>
      </View>
      <View style={styles.display}>
        <Text style={styles.displayNum}>{draft === '' ? '--' : draft}</Text>
        <Text style={styles.displayHint}>
          {lockedVal !== null ? `LOCKED: ${lockedVal}. Press LOCK to change.` : `Choose 0 to ${MAX_NUMBER}`}
        </Text>
      </View>
      <View style={styles.keys}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((k) => (
              <Pressable
                key={String(k)}
                onPress={() => onKey(k)}
                accessibilityRole="button"
                accessibilityLabel={k === 'back' ? 'Delete' : k === 'lock' ? 'Lock in' : String(k)}
                style={({ pressed }) => [styles.key, k === 'lock' && styles.keyLock, pressed && { opacity: 0.6 }]}
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
  );
}

// After LOCK the pad goes away: your number, the clock, and how many have locked in.
export function LockedWait(props: { lockedVal: number; secondsLeft: number; hot: boolean; locked: number; total: number; onChange: () => void }) {
  const { lockedVal, secondsLeft, hot, locked, total, onChange } = props;
  return (
    <View style={styles.console}>
      <View style={styles.clockRow}>
        <Text style={styles.consoleTitle}>Number locked in</Text>
        <Text style={[styles.clock, hot && { color: c.hot }]}>{secondsLeft}</Text>
      </View>
      <View style={[styles.display, { paddingVertical: 14 }]}>
        <Text style={[styles.displayNum, { color: c.win }]}>{lockedVal}</Text>
        <Text style={styles.displayHint}>
          {locked} of {total} have locked in
        </Text>
      </View>
      <Pressable onPress={onChange} accessibilityRole="button" style={({ pressed }) => [styles.changeBtn, pressed && { opacity: 0.6 }]}>
        <Text style={styles.changeText}>Change my number</Text>
      </Pressable>
    </View>
  );
}

// A player who is out watches the round go on.
export function SpectatorWait(props: { secondsLeft: number; locked: number; total: number }) {
  return (
    <View style={styles.console}>
      <View style={styles.clockRow}>
        <Text style={[styles.consoleTitle, { color: c.crimsonSoft }]}>GAME OVER for you</Text>
        <Text style={styles.clock}>{props.secondsLeft}</Text>
      </View>
      <Text style={styles.waitText}>Watching the court… {props.locked} of {props.total} have locked in</Text>
    </View>
  );
}

// The special rules in force, as a banner under the pad. A rule that just started is marked NEW.
export function RuleBanner({ rules, fresh }: { rules: RuleId[]; fresh: RuleId[] }) {
  if (rules.length === 0) return null;
  return (
    <View style={styles.banner}>
      {rules.map((id) => (
        <View key={id} style={styles.bannerRule}>
          <Text style={styles.bannerTitle}>{fresh.includes(id) ? 'NEW SPECIAL RULE' : 'SPECIAL RULE'}</Text>
          <Text style={styles.bannerText}>{RULE_TEXT[id]}</Text>
        </View>
      ))}
    </View>
  );
}

// ------------------------------------------------- 2. the numbers ----
function winnerLines(v: Reveal, n: Names): { head: string; reason: string } {
  const names = v.winners.map(n.who).join(' and ');
  const plural = v.winners.length > 1 || (v.winners.length === 1 && v.winners[0] === n.uid);
  if (v.winners.length === 0) {
    return { head: 'Nobody wins this round.', reason: v.target === null ? 'Nobody chose a number.' : 'Every number was invalid.' };
  }
  const head = `${names} ${plural ? 'win' : 'wins'} the round!`;
  if (v.reason === 'extremes') return { head, reason: '100 beats 0.' };
  if (v.reason === 'exact') return { head, reason: `Exactly on the target, ${v.target === null ? '' : fmt(v.target)}!` };
  if (v.reason === 'tie') return { head, reason: 'Equally close to the target.' };
  const val = v.rows.find((r) => r.uid === v.winners[0])?.value;
  return { head, reason: `${val} is the closest to the target${v.target === null ? '' : `, ${fmt(v.target)}`}.` };
}

function NumberCard(props: { row: Row; shown: boolean; away: boolean; invalid: boolean; winner: boolean; n: Names; still: boolean }) {
  const { row, shown, away, invalid, winner, n, still } = props;
  const body = (
    <View
      style={[
        styles.card,
        row.uid === n.uid && styles.cardMe,
        winner && row.status === 'won' && styles.cardWon,
        invalid && row.status === 'invalid' && styles.cardBad,
      ]}
    >
      <Text style={styles.cardName} numberOfLines={1}>
        {n.who(row.uid)}
      </Text>
      <Text style={styles.cardBig}>{row.value === null ? '—' : row.value}</Text>
      <Text style={[styles.cardSub, invalid && row.status === 'invalid' && { color: c.crimsonSoft }, winner && row.status === 'won' && { color: c.win }]} numberOfLines={1}>
        {winner && row.status === 'won'
          ? 'WINNER'
          : invalid && row.status === 'invalid'
            ? 'INVALID'
            : row.value === null
              ? 'no number'
              : away && row.away !== null
                ? `off by ${fmt(row.away)}`
                : ' '}
      </Text>
    </View>
  );
  if (!shown) return <View style={[styles.cardSlot, { opacity: 0 }]}>{body}</View>;
  return (
    <Appear still={still} style={styles.cardSlot}>
      {body}
    </Appear>
  );
}

function calcText(kind: string, v: Reveal, n: Names): { label: string; text: string } {
  const picked = v.rows.filter((r) => r.value !== null);
  const sum = picked.reduce((t, r) => t + (r.value as number), 0);
  if (kind === 'sum') return { label: 'SUM', text: `${picked.map((r) => r.value).join(' + ')} = ${sum}` };
  if (kind === 'average') return { label: 'AVERAGE', text: `${sum} ÷ ${picked.length} = ${v.average === null ? '—' : fmt(v.average)}` };
  if (kind === 'target')
    return { label: 'TARGET', text: `${v.average === null ? '—' : fmt(v.average)} × 0.8 = ${v.target === null ? '—' : fmt(v.target)}` };
  if (kind === 'invalid') {
    const names = v.rows.filter((r) => r.status === 'invalid').map((r) => n.who(r.uid));
    return { label: 'INVALID', text: `${names.join(', ')} chose the same number as another player.` };
  }
  return { label: 'NO NUMBERS', text: 'Nobody chose a number.' };
}

export function NumbersStage(props: { rev: Reveal; tl: Timeline; elapsed: number; n: Names; still: boolean }) {
  const { rev, tl, elapsed, n, still } = props;
  const winnerShown = elapsed >= tl.winnerAt;
  const invalidShown = tl.invalidAt >= 0 && elapsed >= tl.invalidAt;
  const w = winnerLines(rev, n);
  return (
    <View style={styles.stage}>
      <Text style={styles.stageTitle}>The numbers</Text>
      <View style={styles.grid}>
        {rev.rows.map((row, i) => (
          <NumberCard
            key={row.uid}
            row={row}
            shown={elapsed >= tl.playersAt[i]}
            away={tl.awayAt[i] >= 0 && elapsed >= tl.awayAt[i]}
            invalid={invalidShown}
            winner={winnerShown}
            n={n}
            still={still}
          />
        ))}
      </View>

      <View style={styles.calc}>
        {tl.calc.map((line) => {
          if (elapsed < line.at) return null;
          const t = calcText(line.kind, rev, n);
          return (
            <Appear key={line.kind} still={still} style={styles.calcLine}>
              <Text style={styles.calcLabel}>{t.label}</Text>
              <Text style={[styles.calcText, line.kind === 'target' && { color: c.holo, fontWeight: '900' }]}>{t.text}</Text>
            </Appear>
          );
        })}
      </View>

      {winnerShown && (
        <Appear still={still} style={styles.winner}>
          <Text style={styles.winnerHead}>{w.head}</Text>
          <Text style={styles.winnerReason}>{w.reason}</Text>
        </Appear>
      )}
    </View>
  );
}

// ------------------------------------------------- 3. the scores ----
function ScoreRow(props: { row: Row; shown: boolean; settled: boolean; n: Names; still: boolean }) {
  const { row, shown, settled, n, still } = props;
  const lost = row.before - row.after;
  const won = row.status === 'won';
  const pts = settled ? row.after : row.before;
  const body = (
    <View style={[styles.scoreRow, row.uid === n.uid && styles.cardMe, settled && row.after <= LOSE_AT && styles.scoreOut]}>
      <Text style={styles.scoreName} numberOfLines={1}>
        {n.who(row.uid)}
      </Text>
      <View style={[styles.chip, won ? styles.chipSafe : styles.chipLost]}>
        <Text style={[styles.chipText, { color: won ? c.win : c.crimsonSoft }]}>{won ? '✔ safe' : `−${lost}`}</Text>
      </View>
      <Text style={[styles.scorePts, pts <= -7 && { color: c.crimsonSoft }]}>{pts}</Text>
    </View>
  );
  if (!shown) return <View style={{ opacity: 0 }}>{body}</View>;
  return <Appear still={still}>{body}</Appear>;
}

export function ScoresStage(props: { rev: Reveal; tl: Timeline; elapsed: number; n: Names; name: (id: string) => string; still: boolean }) {
  const { rev, tl, elapsed, n, name, still } = props;
  const noticeShown = tl.noticeAt >= 0 && elapsed >= tl.noticeAt;
  return (
    <View style={styles.stage}>
      <Text style={styles.stageTitle}>Points after round {rev.round}</Text>
      <View style={{ gap: 6 }}>
        {rev.rows.map((row, i) => (
          <ScoreRow
            key={row.uid}
            row={row}
            shown={elapsed >= tl.scoresAt[i]}
            settled={elapsed >= tl.scoresAt[i] + 450}
            n={n}
            still={still}
          />
        ))}
      </View>
      {noticeShown && (
        <Appear still={still} style={styles.notice}>
          {rev.out.map((id) => (
            <Text key={id} style={styles.noticeOut}>
              {id === n.uid ? `GAME OVER for you: ${LOSE_AT} points.` : `GAME OVER for ${name(id)}: ${LOSE_AT} points.`}
            </Text>
          ))}
          {rev.newRules.length > 0 && (
            <View style={[styles.newRule, rev.out.length > 0 && { marginTop: 6 }]}>
              <Text style={styles.newRuleTitle}>NEW SPECIAL RULE</Text>
              {rev.newRules.map((id) => (
                <Text key={id} style={styles.newRuleText}>
                  {RULE_TEXT[id]}
                </Text>
              ))}
              <Text style={styles.newRuleNote}>It starts in the next round.</Text>
            </View>
          )}
        </Appear>
      )}
    </View>
  );
}

// ------------------------------------------------- 4. the end ----
export function OverStage(props: { text: string; order: string[]; pts: Record<string, number>; alive: string[]; n: Names }) {
  const { text, order, pts, alive, n } = props;
  const sorted = order.slice().sort((a, b) => (alive.includes(b) ? 1 : 0) - (alive.includes(a) ? 1 : 0) || (pts[b] ?? 0) - (pts[a] ?? 0));
  return (
    <View style={styles.stage}>
      <View style={styles.over}>
        <Text style={styles.overText}>{text}</Text>
      </View>
      <View style={{ gap: 6 }}>
        {sorted.map((id) => (
          <View key={id} style={[styles.scoreRow, id === n.uid && styles.cardMe, !alive.includes(id) && styles.scoreOut]}>
            <Text style={styles.scoreName} numberOfLines={1}>
              {n.who(id)}
            </Text>
            <Text style={styles.scorePts}>{alive.includes(id) ? pts[id] ?? 0 : 'OUT'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  console: { gap: 10, backgroundColor: c.panel, borderWidth: 2, borderColor: c.gold, borderRadius: 6, padding: 12 },
  clockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  consoleTitle: { color: c.goldBright, fontFamily: FONT_ROYAL, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  clock: { color: c.holo, fontFamily: FONT_ROYAL, fontSize: 26, fontWeight: '900', fontVariant: ['tabular-nums'] },
  display: { alignItems: 'center', backgroundColor: 'rgba(8,24,30,0.9)', borderWidth: 1, borderColor: c.holo, borderRadius: 4, paddingVertical: 8 },
  displayNum: { color: c.holo, fontFamily: FONT_ROYAL, fontSize: 46, fontWeight: '900', fontVariant: ['tabular-nums'], lineHeight: 52 },
  displayHint: { color: c.boneMuted, fontFamily: FONT_ROYAL, fontSize: 12, fontWeight: '600' },
  keys: { gap: 8 },
  keyRow: { flexDirection: 'row', gap: 8 },
  key: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: c.plate, borderWidth: 2, borderColor: c.goldDeep, borderRadius: 6 },
  keyLock: { backgroundColor: c.gold, borderColor: c.goldBright },
  keyText: { color: c.bone, fontFamily: FONT_ROYAL, fontSize: 20, fontWeight: '800' },
  changeBtn: { height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.goldDeep, borderRadius: 6, backgroundColor: c.plate },
  changeText: { color: c.bone, fontFamily: FONT_ROYAL, fontSize: 14, fontWeight: '800' },
  waitText: { color: c.boneMuted, fontFamily: FONT_ROYAL, fontSize: 14, fontWeight: '600', textAlign: 'center' },

  banner: { gap: 6 },
  bannerRule: { backgroundColor: c.panel, borderLeftWidth: 4, borderLeftColor: c.crimson, paddingVertical: 8, paddingHorizontal: 12, gap: 2 },
  bannerTitle: { color: c.crimsonSoft, fontFamily: FONT_ROYAL, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  bannerText: { color: c.bone, fontFamily: FONT_ROYAL, fontSize: 13, lineHeight: 18 },

  stage: { gap: 10 },
  stageTitle: { color: c.goldBright, fontFamily: FONT_ROYAL, fontSize: 16, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cardSlot: { width: '48.5%' },
  card: { alignItems: 'center', backgroundColor: c.plate, borderWidth: 2, borderColor: c.goldDeep, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 4 },
  cardMe: { borderColor: c.gold, backgroundColor: c.plateHi },
  cardWon: { borderColor: c.win, borderWidth: 3 },
  cardBad: { borderColor: c.crimson, borderWidth: 3 },
  cardName: { color: c.boneMuted, fontFamily: FONT_ROYAL, fontSize: 12, fontWeight: '700', maxWidth: '100%' },
  cardBig: { color: c.bone, fontFamily: FONT_ROYAL, fontSize: 30, fontWeight: '900', fontVariant: ['tabular-nums'], lineHeight: 36 },
  cardSub: { color: c.boneMuted, fontFamily: FONT_ROYAL, fontSize: 11, fontWeight: '800', letterSpacing: 1, minHeight: 15 },

  calc: { gap: 6 },
  calcLine: { backgroundColor: 'rgba(8,24,30,0.9)', borderWidth: 1, borderColor: c.holoDeep, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 10, gap: 1 },
  calcLabel: { color: c.holoDeep, fontFamily: FONT_ROYAL, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  calcText: { color: c.bone, fontFamily: FONT_ROYAL, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },

  winner: { backgroundColor: c.panel, borderWidth: 2, borderColor: c.gold, borderRadius: 6, padding: 14, gap: 4, alignItems: 'center' },
  winnerHead: { color: c.goldBright, fontFamily: FONT_ROYAL, fontSize: 19, fontWeight: '900', textAlign: 'center' },
  winnerReason: { color: c.bone, fontFamily: FONT_ROYAL, fontSize: 14, textAlign: 'center' },

  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.plate, borderWidth: 2, borderColor: c.goldDeep, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10 },
  scoreOut: { opacity: 0.5, borderColor: c.vein },
  scoreName: { flex: 1, color: c.bone, fontFamily: FONT_ROYAL, fontSize: 15, fontWeight: '700' },
  chip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 2 },
  chipSafe: { borderColor: c.win },
  chipLost: { borderColor: c.crimsonSoft },
  chipText: { fontFamily: FONT_ROYAL, fontSize: 13, fontWeight: '900' },
  scorePts: { minWidth: 36, textAlign: 'right', color: c.gold, fontFamily: FONT_ROYAL, fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },

  notice: { backgroundColor: c.panel, borderWidth: 2, borderColor: c.crimson, borderRadius: 6, padding: 12, gap: 2 },
  noticeOut: { color: c.crimsonSoft, fontFamily: FONT_ROYAL, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  newRule: { borderTopWidth: 1, borderTopColor: c.crimson, paddingTop: 8, gap: 4 },
  newRuleTitle: { color: c.crimsonSoft, fontFamily: FONT_ROYAL, fontSize: 12, fontWeight: '900', letterSpacing: 3, textAlign: 'center' },
  newRuleText: { color: c.bone, fontFamily: FONT_ROYAL, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  newRuleNote: { color: c.boneMuted, fontFamily: FONT_ROYAL, fontSize: 12, textAlign: 'center' },

  over: { backgroundColor: c.panel, borderWidth: 3, borderColor: c.gold, borderRadius: 6, padding: 18 },
  overText: { color: c.goldBright, fontFamily: FONT_ROYAL, fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 30 },
});
