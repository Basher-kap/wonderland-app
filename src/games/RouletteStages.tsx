import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CHAMBERS, MAX_ROUNDS, REVEAL_LEAD_MS, SHOT_MS, shotResultAt } from '../game/russianRoulette';
import type { Reveal, Shot, State } from '../game/russianRoulette';
import { BulletFace, Cylinder, den, FONT_DEN, shieldColors, Silhouette } from '../gameThemes/russianRoulette';
import Svg from 'react-native-svg';

export type Names = { uid: string; who: (id: string) => string; variant: (id: string) => number };

// ---------------------------------------------------------- top bar ----
// "LIVE 2 / 6": six little chambers, the live ones filled red.
export function Pips({ live }: { live: number }) {
  return (
    <View style={styles.pips} accessible accessibilityLabel={`${live} live bullets of ${CHAMBERS}`}>
      {Array.from({ length: CHAMBERS }, (_, i) => (
        <View key={i} style={[styles.pip, i < live && styles.pipLive]} />
      ))}
    </View>
  );
}

export function TopBar({ st, secs, timed, marginRight }: { st: State; secs: number; timed: boolean; marginRight: number }) {
  const label = st.phase === 'load' ? 'LOAD' : st.phase === 'aim' ? 'AIM' : '';
  return (
    <View style={[styles.topBar, { marginRight }]}>
      <View>
        <Text style={styles.round}>
          ROUND {st.round}
          <Text style={styles.roundOf}> / {MAX_ROUNDS}</Text>
        </Text>
        <View style={styles.liveRow}>
          <Pips live={st.bullets} />
          <Text style={styles.liveText}>
            {st.bullets} LIVE of {CHAMBERS}
          </Text>
        </View>
      </View>
      {timed && (
        <View style={styles.clockWrap}>
          <View style={[styles.clock, secs <= 5 && { borderColor: den.bloodBright }]} accessibilityLabel={`${label}: ${secs} seconds left`}>
            <Text style={[styles.clockText, secs <= 5 && { color: den.bloodBright }]}>{secs}</Text>
          </View>
          <Text style={styles.clockLabel}>{label}</Text>
        </View>
      )}
    </View>
  );
}

// ------------------------------------------------------ loading tray ----
// The live bullets of the round at the centre of the table, and the SPIN button.
export function Tray(props: { total: number; loaded: number; canSpin: boolean; onSpin: () => void }) {
  const { total, loaded, canSpin, onSpin } = props;
  const left = total - loaded;
  return (
    <View style={styles.tray}>
      <View style={styles.trayBullets}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={{ opacity: i < left ? 1 : 0.18 }}>
            <Svg width={34} height={34} viewBox="0 0 34 34">
              <BulletFace x={17} y={17} r={14} />
            </Svg>
          </View>
        ))}
      </View>
      <Text style={styles.trayText}>{left > 0 ? `Tap a chamber to load a bullet (${left} left)` : 'All loaded. Close it and spin!'}</Text>
      <Pressable
        onPress={onSpin}
        disabled={!canSpin}
        accessibilityRole="button"
        style={({ pressed }) => [styles.spin, !canSpin && { opacity: 0.35 }, pressed && { transform: [{ scale: 0.97 }] }]}
      >
        <Text style={styles.spinText}>CLOSE & SPIN</Text>
      </Pressable>
    </View>
  );
}

// ------------------------------------------------------------- aim ----
export function AimPanel(props: { st: State; n: Names; selected: string | null; onAim: (target: string) => void }) {
  const { st, n, selected, onAim } = props;
  const others = st.alive.filter((id) => id !== n.uid);
  return (
    <View style={styles.aim}>
      <Text style={styles.aimTitle}>{selected === null ? 'WHO DO YOU SHOOT?' : 'LOCKED ON. CHANGE IT IF YOU LIKE'}</Text>
      <Pressable onPress={() => onAim('self')} accessibilityRole="button" style={({ pressed }) => [styles.aimSelf, selected === 'self' && styles.aimOn, pressed && { opacity: 0.7 }]}>
        <Text style={styles.aimSelfText}>MYSELF</Text>
        <Text style={styles.aimSelfSub}>aiming yourself grants protection</Text>
      </Pressable>
      <Text style={styles.aimNote}>Every trigger is pulled at the same time when the clock runs out. No decision and you are defenseless: no shot, no protection.</Text>
      <View style={styles.aimGrid}>
        {others.map((id) => (
          <Pressable key={id} onPress={() => onAim(id)} accessibilityRole="button" accessibilityLabel={`Shoot ${n.who(id)}`} style={({ pressed }) => [styles.aimBtn, selected === id && styles.aimOn, pressed && { backgroundColor: den.bloodDark }]}>
            <Silhouette size={26} variant={n.variant(id)} />
            <Text style={styles.aimName} numberOfLines={1}>
              {n.who(id)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------- roster ----
export function Roster({ st, n, shown, shielded }: { st: State; n: Names; shown: Set<string> | null; shielded: Set<string> }) {
  return (
    <View style={styles.roster}>
      {st.order
        .filter((id) => !st.gone.includes(id))
        .map((id) => {
          const dead = shown ? shown.has(id) || (!st.alive.includes(id) && !st.reveal?.shots.some((s) => s.uid === id)) : !st.alive.includes(id);
          const ready = st.phase === 'aim' && st.aimed.includes(id);
          return (
            <View key={id} style={styles.gambler}>
              <Silhouette size={34} variant={n.variant(id)} dead={dead} shield={!dead && shielded.has(id)} />
              <Text style={[styles.gamblerName, id === n.uid && { color: den.gold }, dead && { color: den.boneMuted, textDecorationLine: 'line-through' }]} numberOfLines={1}>
                {id === n.uid ? 'You' : n.who(id)}
              </Text>
              <Text style={styles.gamblerState}>{dead ? 'OUT' : shielded.has(id) ? 'SHIELD' : ready ? 'AIMED' : st.phase === 'load' && st.spun.includes(id) ? 'SPUN' : ' '}</Text>
            </View>
          );
        })}
    </View>
  );
}

// ---------------------------------------------------------- reveal ----
function shotText(s: Shot, n: Names): string {
  const who = n.who(s.uid);
  const you = s.uid === n.uid;
  const target = s.aim === 'self' ? (you ? 'yourself' : 'themself') : n.who(s.aim);
  switch (s.outcome) {
    case 'idle':
      return `${who} froze. Defenseless.`;
    case 'click':
      return `${who} aimed at ${target}: click.`;
    case 'shielded':
      return `${who} aimed at ${target}: click. Protected.`;
    case 'suicide':
      return `${who} shot ${target}.`;
    case 'hit':
      return `${who} shot ${target}.`;
    default:
      return `${who} shot ${target}, but ${target === 'yourself' ? 'you were' : 'they were'} protected.`;
  }
}

export function deadIds(rev: Reveal, resolved: number): Set<string> {
  const d = new Set<string>();
  rev.shots.slice(0, resolved).forEach((s) => {
    if (s.outcome === 'suicide') d.add(s.uid);
    if (s.outcome === 'hit') d.add(s.aim);
  });
  return d;
}

// Who is under the shield force once `resolved` shots have landed.
export function shieldedIds(rev: Reveal, resolved: number): Set<string> {
  const d = new Set<string>();
  rev.shots.slice(0, resolved).forEach((s) => {
    if (s.outcome === 'shielded') d.add(s.uid);
    if (s.outcome === 'blocked') d.add(s.aim);
  });
  return d;
}

// How many shots have landed after `elapsed` ms of the reveal.
export const resolvedAt = (rev: Reveal, elapsed: number) => rev.shots.filter((_, i) => elapsed >= shotResultAt(i)).length;

export function ShotStage(props: { rev: Reveal; elapsed: number; n: Names; cylSize: number; still: boolean; survivors: number; nextBullets: number | null }) {
  const { rev, elapsed, n, cylSize, still, survivors, nextBullets } = props;
  const total = rev.shots.length;
  const resolved = resolvedAt(rev, elapsed);
  const idx = elapsed < REVEAL_LEAD_MS ? -1 : Math.min(total - 1, Math.floor((elapsed - REVEAL_LEAD_MS) / SHOT_MS));
  const finished = elapsed >= REVEAL_LEAD_MS + total * SHOT_MS;
  const shot = idx >= 0 ? rev.shots[idx] : null;
  const landed = shot !== null && elapsed >= shotResultAt(idx);
  const dead = deadIds(rev, resolved);

  let head = 'ALL TRIGGERS PULLED!';
  if (finished) head = rev.dead.length > 0 ? `${rev.dead.length} ELIMINATED` : 'NOBODY FELL';
  else if (shot) head = `SHOT ${idx + 1} OF ${total}`;

  return (
    <View style={styles.stage}>
      <Text style={styles.stageHead}>{head}</Text>
      {idx === -1 && !finished && (
        <View style={styles.caption}>
          <Text style={styles.bang}>FIRE!</Text>
          <Text style={styles.captionSub}>Every gun fired at the same moment. Now the results…</Text>
        </View>
      )}
      {shot && !finished && (
        <>
          <View style={styles.duel}>
            <View style={styles.duelSide}>
              <Silhouette size={58} variant={n.variant(shot.uid)} dead={landed && dead.has(shot.uid)} shield={landed && shot.outcome === 'shielded'} />
              <Text style={styles.duelName} numberOfLines={1}>
                {n.who(shot.uid)}
              </Text>
            </View>
            <View style={styles.duelMid}>
              <Cylinder size={cylSize} loaded={[]} closed spinKey={0} still={still} tense={!landed} />
              <Text style={styles.arrow}>{shot.aim === 'self' ? '↺' : '→'}</Text>
            </View>
            <View style={styles.duelSide}>
              {shot.aim === 'self' ? (
                <View style={{ height: 58 * 1.15 }} />
              ) : (
                <Silhouette size={58} variant={n.variant(shot.aim)} dead={landed && dead.has(shot.aim)} aimed={!landed} shield={landed && shot.outcome === 'blocked'} />
              )}
              <Text style={styles.duelName} numberOfLines={1}>
                {shot.aim === 'self' ? 'themself' : n.who(shot.aim)}
              </Text>
            </View>
          </View>
          <View style={styles.caption}>
            {!landed ? (
              <Text style={styles.suspense}>…</Text>
            ) : shot.outcome === 'blocked' || shot.outcome === 'shielded' ? (
              <Text style={styles.shield}>{shot.outcome === 'blocked' ? 'BLOCKED!' : 'SHIELD!'}</Text>
            ) : shot.outcome === 'idle' ? (
              <Text style={styles.click}>silence.</Text>
            ) : shot.live ? (
              <Text style={styles.bang}>BANG!</Text>
            ) : (
              <Text style={styles.click}>click.</Text>
            )}
          </View>
        </>
      )}
      {finished && (
        <View style={styles.caption}>
          <Text style={styles.captionSub}>
            {survivors} {survivors === 1 ? 'gambler' : 'gamblers'} left standing
          </Text>
          {nextBullets !== null && <Text style={styles.captionSub}>Next round: {nextBullets} live {nextBullets === 1 ? 'bullet' : 'bullets'}</Text>}
        </View>
      )}
      <View style={styles.log}>
        {rev.shots.slice(0, resolved).map((s, i) => (
          <Text key={i} style={[styles.logLine, s.live && { color: den.bloodBright }, (s.outcome === 'shielded' || s.outcome === 'blocked') && { color: shieldColors.teal }]} numberOfLines={1}>
            {s.live ? '● ' : '○ '}
            {shotText(s, n)}
          </Text>
        ))}
      </View>
    </View>
  );
}

// -------------------------------------------------------------- over ----
export function OverPanel({ st, n }: { st: State; n: Names }) {
  const won = st.winner;
  return (
    <View style={styles.over}>
      {won ? <Silhouette size={80} variant={n.variant(won)} /> : null}
      <Text style={styles.overHead}>{won ? (won === n.uid ? 'YOU WALK OUT ALIVE' : `${n.who(won).toUpperCase()} WALKS OUT`) : 'NOBODY WALKS OUT'}</Text>
      <Text style={styles.overSub}>
        {won
          ? 'The last gambler standing wins the pot.'
          : st.alive.length > 1
            ? 'Several of you survived all 12 rounds. The house keeps the pot.'
            : 'The den is silent. Everybody fell.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  round: { color: den.gold, fontFamily: FONT_DEN, fontSize: 22, letterSpacing: 2 },
  roundOf: { color: den.boneMuted, fontSize: 14 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveText: { color: den.bone, fontFamily: FONT_DEN, fontSize: 12, letterSpacing: 1 },
  pips: { flexDirection: 'row', gap: 4 },
  pip: { width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: den.steel, backgroundColor: 'transparent' },
  pipLive: { backgroundColor: den.bloodBright, borderColor: den.bloodBright },
  clockWrap: { alignItems: 'center' },
  clock: { minWidth: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: den.panel, borderColor: den.gold, borderWidth: 2 },
  clockText: { color: den.gold, fontFamily: FONT_DEN, fontSize: 22 },
  clockLabel: { color: den.boneMuted, fontFamily: FONT_DEN, fontSize: 10, letterSpacing: 2 },

  tray: { alignItems: 'center', gap: 8 },
  trayBullets: { flexDirection: 'row', gap: 6, minHeight: 34 },
  trayText: { color: den.boneMuted, fontFamily: FONT_DEN, fontSize: 13, letterSpacing: 0.5, textAlign: 'center' },
  spin: { backgroundColor: den.blood, borderColor: den.gold, borderWidth: 2, borderRadius: 4, paddingHorizontal: 30, paddingVertical: 10 },
  spinText: { color: den.bone, fontFamily: FONT_DEN, fontSize: 20, letterSpacing: 3 },

  aim: { gap: 8 },
  aimTitle: { color: den.gold, fontFamily: FONT_DEN, fontSize: 15, letterSpacing: 3, textAlign: 'center' },
  aimSelf: { backgroundColor: den.panel, borderColor: den.gold, borderWidth: 2, borderRadius: 4, alignItems: 'center', paddingVertical: 8 },
  aimSelfText: { color: den.gold, fontFamily: FONT_DEN, fontSize: 18, letterSpacing: 3 },
  aimSelfSub: { color: den.boneMuted, fontFamily: FONT_DEN, fontSize: 11 },
  aimNote: { color: den.boneMuted, fontFamily: FONT_DEN, fontSize: 11, textAlign: 'center' },
  aimGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  aimBtn: { width: '48.8%', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: den.panel, borderColor: den.blood, borderWidth: 2, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 5 },
  aimName: { flex: 1, color: den.bone, fontFamily: FONT_DEN, fontSize: 14 },
  aimOn: { backgroundColor: den.bloodDark, borderColor: den.bloodBright },

  roster: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  gambler: { width: 58, alignItems: 'center' },
  gamblerName: { color: den.bone, fontFamily: FONT_DEN, fontSize: 11, maxWidth: 58 },
  gamblerState: { color: den.bloodBright, fontFamily: FONT_DEN, fontSize: 9, letterSpacing: 1, minHeight: 11 },

  stage: { alignItems: 'center', gap: 8 },
  stageHead: { color: den.gold, fontFamily: FONT_DEN, fontSize: 16, letterSpacing: 3 },
  duel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
  duelSide: { width: 82, alignItems: 'center' },
  duelName: { color: den.bone, fontFamily: FONT_DEN, fontSize: 13, maxWidth: 82 },
  duelMid: { alignItems: 'center' },
  arrow: { color: den.bloodBright, fontFamily: FONT_DEN, fontSize: 26 },
  caption: { alignItems: 'center', minHeight: 64, justifyContent: 'center', gap: 2 },
  suspense: { color: den.boneMuted, fontFamily: FONT_DEN, fontSize: 40 },
  shield: { color: shieldColors.teal, fontFamily: FONT_DEN, fontSize: 42, letterSpacing: 4 },
  bang: { color: den.bloodBright, fontFamily: FONT_DEN, fontSize: 50, letterSpacing: 4 },
  click: { color: den.bone, fontFamily: FONT_DEN, fontSize: 24, letterSpacing: 2 },
  captionSub: { color: den.bone, fontFamily: FONT_DEN, fontSize: 14, textAlign: 'center' },
  log: { alignSelf: 'stretch', gap: 1 },
  logLine: { color: den.boneMuted, fontFamily: FONT_DEN, fontSize: 12 },

  over: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  overHead: { color: den.gold, fontFamily: FONT_DEN, fontSize: 28, letterSpacing: 3, textAlign: 'center' },
  overSub: { color: den.boneMuted, fontFamily: FONT_DEN, fontSize: 14, textAlign: 'center' },
});