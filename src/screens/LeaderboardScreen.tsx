import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DomainIcon, DomainStat } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { LADDERS, Track, nextTitle, titleFor } from '../data/ranks';
import * as api from '../lib/api';
import { isDemoMode } from '../lib/firebase';
import { colors, DOMAIN_ORDER, domainInfo, radius } from '../theme';

// Demo mode only. Points: +10 per round won, -5 per round lost, per domain.
const DEMO: api.LeaderboardRow[] = [
  { uid: '1', username: 'Cheshire', tickets: 5, logic: 340, experience: 220, chance: 270, total: 830, wins: 83 },
  { uid: '2', username: 'Mad Hatter', tickets: 4, logic: 120, experience: 310, chance: 80, total: 510, wins: 51 },
  { uid: '3', username: 'White Rabbit', tickets: 6, logic: 60, experience: 40, chance: 210, total: 310, wins: 31 },
  { uid: '4', username: 'Dormouse', tickets: 2, logic: 20, experience: 10, chance: 30, total: 60, wins: 6 },
];

const TRACKS: Track[] = ['logic', 'experience', 'chance', 'all'];

export function LeaderboardScreen() {
  const { uid } = useAuth();
  const [data, setData] = useState<api.LeaderboardRow[]>(isDemoMode ? DEMO : []);

  useEffect(() => {
    if (isDemoMode) return;
    return api.subscribeLeaderboard(setData, (e) => console.warn('leaderboard failed', e));
  }, []);

  // Titles are worked out here from the points (thresholds live in data/ranks.ts).
  const rows = useMemo(
    () =>
      data.map((p) => ({
        ...p,
        titles: [
          titleFor('logic', p.logic),
          titleFor('experience', p.experience),
          titleFor('chance', p.chance),
          titleFor('all', Math.min(p.logic, p.experience, p.chance)),
        ].filter(Boolean) as string[],
      })),
    [data]
  );

  const me = rows.find((r) => r.uid === uid);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Leaderboard</Text>
        <Text style={styles.rule}>+10 points for every round you win, -5 for every round you lose. Draws change nothing.</Text>

        {me && (
          <View style={styles.meCard}>
            <Text style={styles.meTitle}>Your points: {me.total}</Text>
            {DOMAIN_ORDER.map((d) => {
              const pts = me[d];
              const next = nextTitle(d, pts);
              return (
                <View key={d} style={styles.meRow}>
                  <DomainIcon domain={d} size={18} />
                  <Text style={styles.meLine}>
                    <Text style={{ color: domainInfo[d].color }}>
                      {domainInfo[d].label}  {pts}
                    </Text>
                    {next ? `   ·   ${next.missing} to ${next.title}` : '   ·   top title reached'}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {rows.length === 0 && <Text style={styles.empty}>No scores yet. Win a round to get on the board.</Text>}

        {rows.map((r, i) => (
          <View key={r.uid} style={[styles.row, r.uid === uid && styles.rowMe]}>
            <Text style={styles.rank}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {r.username}
                {r.uid === uid ? '  (you)' : ''}
              </Text>
              <View style={styles.scoresRow}>
                {DOMAIN_ORDER.map((d) => (
                  <DomainStat key={d} domain={d} value={r[d]} size={13} />
                ))}
              </View>
              <Text style={styles.titles}>{r.titles.length ? r.titles.join(' · ') : 'No title yet'}</Text>
            </View>
            <Text style={styles.total}>{r.total}</Text>
          </View>
        ))}

        <Text style={[styles.heading, { marginTop: 28 }]}>Ranking titles</Text>
        {TRACKS.map((t) => (
          <View key={t} style={styles.ladder}>
            <Text style={styles.ladderLabel}>
              {LADDERS[t].label}
              {t === 'all' ? ' (your weakest domain counts)' : ''}
            </Text>
            <Text style={styles.ladderTitles}>
              {LADDERS[t].titles.map((title, i) => `${title} (${LADDERS[t].thresholds[i]})`).join('  →  ')}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  heading: { color: colors.text, fontSize: 22, fontWeight: '600', marginBottom: 6 },
  rule: { color: colors.muted, fontSize: 13, marginBottom: 14 },
  empty: { color: colors.muted, marginBottom: 12 },
  meCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.accent,
    gap: 4,
  },
  meTitle: { color: colors.accent, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  meLine: { color: colors.muted, fontSize: 13, flexShrink: 1 },
  meRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoresRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowMe: { borderColor: colors.accent },
  rank: { color: colors.accent, fontSize: 20, fontWeight: '700', width: 24, textAlign: 'center' },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  scores: { color: colors.muted, fontSize: 13, marginTop: 2 },
  titles: { color: colors.accent, fontSize: 12, marginTop: 2 },
  total: { color: colors.text, fontSize: 20, fontWeight: '700' },
  ladder: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ladderLabel: { color: colors.text, fontWeight: '600', marginBottom: 4 },
  ladderTitles: { color: colors.muted, fontSize: 13, lineHeight: 19 },
});
