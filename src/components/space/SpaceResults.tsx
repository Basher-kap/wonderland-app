import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, DomainIcon, useReduceMotion } from '../ui';
import { Glint, StarGlass } from './SpaceGlass';
import { DOMAIN_ORDER, Domain, domainInfo, space } from '../../theme';
import { START_LIVES } from '../../game';

// How a round and a match end, on the frame around the games (GameScreen). The games themselves do not use these.
// One memorable moment each: a nova of light behind the headline, then a small constellation under it.

type Tone = 'amber' | 'ice';
const GLOW: Record<Tone, string> = { amber: space.amber, ice: space.ice };

// A ring of light and a handful of sparks that fly out from the middle, once.
function Nova({ tone, size = 190 }: { tone: Tone; size?: number }) {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const a = Animated.timing(t, { toValue: 1, duration: 1500, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [reduce, t]);
  if (reduce) return null;
  const c = GLOW[tone];
  const ring = (delay: number, max: number) => ({
    opacity: t.interpolate({ inputRange: [0, delay + 0.05, 1], outputRange: [0, 0.7, 0], extrapolate: 'clamp' }),
    transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.2, max] }) }],
  });
  const n = 18;
  return (
    <View pointerEvents="none" style={[styles.novaWrap, { width: size, height: size }]}>
      <Animated.View style={[styles.ring, { borderColor: c, width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25 }, ring(0, 2.2)]} />
      <Animated.View style={[styles.ring, { borderColor: c, width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25 }, ring(0.18, 1.5)]} />
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (i % 2) * 0.12;
        const far = size * (0.3 + (i % 3) * 0.09);
        return (
          <Animated.View
            key={i}
            style={[
              styles.spark,
              {
                backgroundColor: i % 3 === 0 ? '#FFFFFF' : c,
                opacity: t.interpolate({ inputRange: [0, 0.08, 0.75, 1], outputRange: [0, 1, 0.5, 0] }),
                transform: [
                  { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * far] }) },
                  { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * far] }) },
                  { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1.6, 0.3] }) },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

// Five stars joined by hairlines; the stars twinkle, one after another.
function Constellation({ tone, width = 150 }: { tone: Tone; width?: number }) {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 3600, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduce, t]);
  const h = 34;
  const pts = [
    [4, 22],
    [width * 0.27, 8],
    [width * 0.5, 20],
    [width * 0.74, 6],
    [width - 4, 18],
  ];
  const c = GLOW[tone];
  return (
    <View style={{ width, height: h }} accessible={false}>
      <Svg width={width} height={h} style={StyleSheet.absoluteFill}>
        {pts.slice(1).map((p, i) => (
          <Line key={i} x1={pts[i][0]} y1={pts[i][1]} x2={p[0]} y2={p[1]} stroke={c} strokeOpacity={0.35} strokeWidth={0.8} />
        ))}
      </Svg>
      {pts.map(([x, y], i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: x - 6,
            top: y - 6,
            width: 12,
            height: 12,
            opacity: reduce
              ? 1
              : t.interpolate({
                  inputRange: [0, 0.05 + i * 0.16, 0.15 + i * 0.16, 0.3 + i * 0.16, 1],
                  outputRange: [0.45, 0.45, 1, 0.45, 0.45],
                }),
          }}
        >
          <Svg width={12} height={12}>
            <Circle cx={6} cy={6} r={5} fill={c} fillOpacity={0.18} />
            <Circle cx={6} cy={6} r={1.8} fill="#FFFFFF" />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

// The headline drops in from close up, as a star comes into focus.
function Headline({ children, tone }: { children: React.ReactNode; tone: Tone }) {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    const a = Animated.timing(t, { toValue: 1, duration: 650, delay: 80, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [reduce, t]);
  return (
    <Animated.Text
      accessibilityRole="header"
      style={[
        styles.headline,
        {
          textShadowColor: GLOW[tone],
          opacity: t.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1.7, 1] }) }],
        },
      ]}
    >
      {children}
    </Animated.Text>
  );
}

/** The end of a round: who took it, and what it cost you. The host draws the next game from here. */
export function RoundResult({
  mode,
  winnerName,
  forfeiters,
  crew,
  isHost,
  busy,
  onNext,
}: {
  mode: 'won' | 'lost' | 'draw';
  winnerName?: string;
  forfeiters: string[];
  crew: Crew[];
  isHost: boolean;
  busy: boolean;
  onNext: () => void;
}) {
  const tone: Tone = mode === 'won' ? 'amber' : 'ice';
  const title = mode === 'won' ? 'You won the round' : mode === 'draw' ? 'A draw' : `${winnerName ?? 'A player'} won the round`;
  const sub = mode === 'won' ? 'Everyone else loses a life.' : mode === 'draw' ? 'Nobody loses a life.' : 'You lose a life.';
  return (
    <StarGlass tone={tone} contentStyle={styles.center}>
      <Nova tone={tone} />
      <Glint size={14} color={GLOW[tone]} />
      <Headline tone={tone}>{title}</Headline>
      <View style={styles.subRow}>
        {mode === 'lost' && <MaterialCommunityIcons name="heart-broken" size={16} color={space.danger} />}
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Constellation tone={tone} />
      {forfeiters.map((n) => (
        <View key={n} style={styles.chip}>
          <Text style={styles.chipText}>{`${n} forfeited this game`}</Text>
        </View>
      ))}
      <CrewRoster players={crew} />
      {isHost ? (
        <Button tone="space" label="Draw next game" disabled={busy} onPress={onNext} style={styles.cta} />
      ) : (
        <Waiting label="Waiting for the host to draw the next game" />
      )}
    </StarGlass>
  );
}

/** The end of a match: the winner, and what it did to your points in each domain. */
export function MatchResult({
  mode,
  winnerName,
  quitName,
  crew,
  delta,
  onLeave,
}: {
  mode: 'won' | 'lost' | 'none';
  winnerName?: string;
  quitName?: string;
  crew: Crew[];
  delta: Record<Domain, number> | null;
  onLeave: () => void;
}) {
  const tone: Tone = mode === 'won' ? 'amber' : 'ice';
  const title = mode === 'won' ? 'You won the match' : winnerName ? `${winnerName} won the match` : 'Match over';
  return (
    <StarGlass tone={tone} contentStyle={styles.center}>
      <Nova tone={tone} size={230} />
      <Glint size={16} color={GLOW[tone]} />
      <Headline tone={tone}>{title}</Headline>
      {quitName ? <Text style={styles.sub}>{`${quitName} forfeited the match.`}</Text> : null}
      <Constellation tone={tone} width={190} />
      <CrewRoster players={crew} />
      {delta && (
        <View style={styles.orbs}>
          {DOMAIN_ORDER.map((d, i) => (
            <Orb key={d} domain={d} value={delta[d]} index={i} />
          ))}
        </View>
      )}
      <Text style={styles.foot}>{delta ? 'Your points this match. Tickets update automatically.' : 'Tickets update automatically.'}</Text>
      <Button tone="space" label="Back to lobby" variant="secondary" onPress={onLeave} style={styles.cta} />
    </StarGlass>
  );
}

export type Crew = { id: string; name: string; lives: number; me: boolean };

/**
 * Who is still in the fight: one line per player, a ring with their initial, and one small star per life.
 * The stars light up one after another; with three lives or fewer they turn red. Most lives first.
 */
function CrewRoster({ players }: { players: Crew[] }) {
  const sorted = [...players].sort((a, b) => b.lives - a.lives);
  return (
    <View style={styles.roster} accessibilityLabel="Players and remaining lives">
      {sorted.map((p, i) => (
        <CrewRow key={p.id} p={p} index={i} />
      ))}
    </View>
  );
}

function CrewRow({ p, index }: { p: Crew; index: number }) {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    const a = Animated.timing(t, { toValue: 1, duration: 1000, delay: 450 + index * 130, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [reduce, t, index]);
  const out = p.lives <= 0;
  const low = !out && p.lives <= 3;
  const glow = out ? space.textFaint : low ? space.danger : space.amber;
  const ring = out ? space.line : p.me ? space.amber : space.iceLine;
  const lives = Math.max(0, Math.min(START_LIVES, p.lives));
  return (
    <Animated.View
      accessible
      accessibilityLabel={`${p.name}, ${p.lives} lives${p.me ? ', you' : ''}`}
      style={[
        styles.crewRow,
        p.me && styles.crewMe,
        {
          opacity: t.interpolate({ inputRange: [0, 0.35], outputRange: [0, 1], extrapolate: 'clamp' }),
          transform: [{ translateY: t.interpolate({ inputRange: [0, 0.35], outputRange: [12, 0], extrapolate: 'clamp' }) }],
        },
      ]}
    >
      <View style={[styles.crewRing, { borderColor: ring }, !out && p.me && styles.crewRingMe]}>
        <Text style={[styles.crewInitial, { color: out ? space.textFaint : space.text }]}>{p.name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <Text style={[styles.crewName, { color: out ? space.textFaint : p.me ? space.amber : space.text }]} numberOfLines={1}>
        {p.name}
      </Text>
      <View style={styles.pips}>
        {Array.from({ length: START_LIVES }, (_, k) => {
          const on = k < lives;
          if (!on) return <MaterialCommunityIcons key={k} name="star-four-points" size={9} color="rgba(255,255,255,0.12)" />;
          const start = 0.35 + (k / START_LIVES) * 0.6;
          return (
            <Animated.View
              key={k}
              style={{
                opacity: t.interpolate({ inputRange: [start, start + 0.05], outputRange: [0.1, 1], extrapolate: 'clamp' }),
                transform: [{ scale: t.interpolate({ inputRange: [start, start + 0.03, start + 0.1], outputRange: [0.5, 1.5, 1], extrapolate: 'clamp' }) }],
              }}
            >
              <MaterialCommunityIcons
                name="star-four-points"
                size={9}
                color={glow}
                style={{ textShadowColor: glow, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 }}
              />
            </Animated.View>
          );
        })}
      </View>
      <Text style={[styles.crewLives, { color: glow }]}>{p.lives}</Text>
    </Animated.View>
  );
}

function Orb({ domain, value, index }: { domain: Domain; value: number; index: number }) {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    const a = Animated.timing(t, { toValue: 1, duration: 600, delay: 500 + index * 160, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [reduce, t, index]);
  const color = domainInfo[domain].color;
  const txt = value > 0 ? `+${value}` : value < 0 ? `-${Math.abs(value)}` : '0';
  return (
    <Animated.View
      style={[styles.orbWrap, { opacity: t, transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }]}
      accessible
      accessibilityLabel={`${domainInfo[domain].label} ${txt} points`}
    >
      <View style={[styles.orb, { borderColor: color, shadowColor: color }]}>
        <DomainIcon domain={domain} size={24} />
      </View>
      <Text style={[styles.orbValue, { color: value > 0 ? space.amber : value < 0 ? space.danger : space.textDim }]}>{txt}</Text>
    </Animated.View>
  );
}

/** One dot per player: amber when that player has handed in a result, a slow pulse while they are still playing. */
export function WaitingPulse({ done, total, label }: { done: number; total: number; label: string }) {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 0.9, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0.3, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, t]);
  return (
    <StarGlass contentStyle={styles.center}>
      <View style={styles.dots} accessible accessibilityLabel={`${done} of ${total} finished`}>
        {Array.from({ length: total }, (_, i) =>
          i < done ? (
            <View key={i} style={[styles.dot, styles.dotDone]} />
          ) : (
            <Animated.View key={i} style={[styles.dot, { opacity: t }]} />
          )
        )}
      </View>
      <Text style={styles.sub}>{label}</Text>
    </StarGlass>
  );
}

// A quiet line with three pulsing stars, for "waiting" inside a result.
function Waiting({ label }: { label: string }) {
  return (
    <View style={styles.waiting}>
      <Glint size={8} />
      <Text style={styles.foot}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 26, paddingHorizontal: 18, gap: 8 },
  novaWrap: { position: 'absolute', top: 6, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 1.5 },
  spark: { position: 'absolute', width: 3, height: 3, borderRadius: 2 },
  headline: {
    color: space.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sub: { color: space.textDim, fontSize: 14, textAlign: 'center' },
  foot: { color: space.textFaint, fontSize: 12, textAlign: 'center' },
  chip: {
    borderWidth: 1,
    borderColor: space.amberLine,
    backgroundColor: space.amberWash,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  chipText: { color: space.amber, fontSize: 12, fontWeight: '600' },
  cta: { alignSelf: 'stretch', marginTop: 8 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  roster: { alignSelf: 'stretch', gap: 6, marginTop: 6 },
  crewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: space.line,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  crewMe: { borderColor: space.amberLine, backgroundColor: space.amberWash },
  crewRing: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  crewRingMe: { shadowColor: space.amber, shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  crewInitial: { fontSize: 13, fontWeight: '700' },
  crewName: { flex: 1, fontSize: 14, fontWeight: '600', minWidth: 0 },
  pips: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  crewLives: { width: 22, textAlign: 'right', fontSize: 15, fontWeight: '800' },
  orbs: { flexDirection: 'row', gap: 22, marginTop: 6 },
  orbWrap: { alignItems: 'center', gap: 6 },
  orb: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  orbValue: { fontSize: 18, fontWeight: '800' },
  dots: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: space.textDim },
  dotDone: {
    backgroundColor: space.amber,
    shadowColor: space.amber,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});
