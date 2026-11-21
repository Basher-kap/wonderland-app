import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DomainIcon, DomainStat } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { LADDERS, Track, nextTitle, titleFor } from '../data/ranks';
import * as api from '../lib/api';
import { isDemoMode } from '../lib/firebase';
import { DOMAIN_ORDER, domainInfo } from '../theme';
import { listPanel, panel, rowDivider, space, typo } from '../spaceTheme';

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

        {rows.length > 0 && (
          <View style={styles.table}>
            {rows.map((r, i) => (
              <View
                key={r.uid}
                style={[styles.row, i < rows.length - 1 && rowDivider, r.uid === uid && styles.rowMe]}
              >
                <Text style={[styles.rank, i === 0 && { color: space.amber }]}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {r.username}
                    {r.uid === uid ? <Text style={styles.you}>  (you)</Text> : null}
                  </Text>
                  <View style={styles.scoresRow}>
                    {DOMAIN_ORDER.map((d) => (
                      <DomainStat key={d} domain={d} value={r[d]} size={13} color={space.textDim} />
                    ))}
                  </View>
                  <Text style={styles.titles}>{r.titles.length ? r.titles.join(' · ') : 'No title yet'}</Text>
                </View>
                <Text style={styles.total}>{r.total}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.heading, { marginTop: 32 }]}>Ranking titles</Text>
        <View style={styles.table}>
          {TRACKS.map((t, i) => (
            <View key={t} style={[styles.ladder, i < TRACKS.length - 1 && rowDivider]}>
              <Text style={styles.ladderLabel}>
                {LADDERS[t].label}
                {t === 'all' ? ' (your weakest domain counts)' : ''}
              </Text>
              <Text style={styles.ladderTitles}>
                {LADDERS[t].titles.map((title, j) => `${title} (${LADDERS[t].thresholds[j]})`).join('  →  ')}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, paddingBottom: 24 },
  heading: { ...typo.title, marginBottom: 6 },
  rule: { ...typo.caption, marginBottom: 18 },
  empty: { ...typo.caption, marginBottom: 12 },
  meCard: { ...panel, borderColor: space.amberLine, borderTopColor: space.amberLine, padding: 16, marginBottom: 20, gap: 6 },
  meTitle: { color: space.amber, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  meLine: { ...typo.caption, flexShrink: 1 },
  meRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  table: { ...listPanel },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowMe: { backgroundColor: space.amberWash },
  rank: { color: space.textDim, fontSize: 18, fontWeight: '700', width: 28, textAlign: 'center' },
  name: { ...typo.body, fontWeight: '600' },
  you: { color: space.ice, fontWeight: '400', fontSize: 14 },
  scoresRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  titles: { color: space.ice, fontSize: 12, marginTop: 3 },
  total: { color: space.text, fontSize: 20, fontWeight: '700' },
  ladder: { padding: 14 },
  ladderLabel: { ...typo.body, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  ladderTitles: { ...typo.caption, lineHeight: 19 },
});