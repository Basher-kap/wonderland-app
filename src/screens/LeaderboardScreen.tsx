import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LADDERS, Track, titleFor } from '../data/ranks';
import * as api from '../lib/api';
import { isDemoMode } from '../lib/firebase';
import { colors, domainInfo, radius } from '../theme';

// Demo mode only.
const DEMO: api.LeaderboardRow[] = [
  { uid: '1', username: 'Cheshire', tickets: 5, logic: 34, experience: 22, chance: 27, total: 83 },
  { uid: '2', username: 'Mad Hatter', tickets: 4, logic: 12, experience: 31, chance: 8, total: 51 },
  { uid: '3', username: 'White Rabbit', tickets: 6, logic: 6, experience: 4, chance: 21, total: 31 },
  { uid: '4', username: 'Dormouse', tickets: 2, logic: 2, experience: 1, chance: 3, total: 6 },
];

const TRACKS: Track[] = ['logic', 'experience', 'chance', 'all'];

export function LeaderboardScreen() {
  const [data, setData] = useState<api.LeaderboardRow[]>(isDemoMode ? DEMO : []);

  useEffect(() => {
    if (isDemoMode) return;
    return api.subscribeLeaderboard(setData, (e) => console.warn('leaderboard failed', e));
  }, []);

  // Titles are worked out here from the win counts (thresholds live in data/ranks.ts).
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

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Leaderboard</Text>

        {rows.length === 0 && <Text style={styles.empty}>No scores yet. Win a match to get on the board.</Text>}

        {rows.map((r, i) => (
          <View key={r.uid} style={styles.row}>
            <Text style={styles.rank}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{r.username}</Text>
              <Text style={styles.scores}>
                {domainInfo.logic.glyph} {r.logic}   {domainInfo.experience.glyph} {r.experience}   {domainInfo.chance.glyph} {r.chance}
              </Text>
              <Text style={styles.titles}>{r.titles.length ? r.titles.join(' · ') : 'No title yet'}</Text>
            </View>
            <Text style={styles.total}>{r.total}</Text>
          </View>
        ))}

        <Text style={[styles.heading, { marginTop: 28 }]}>Ranking ladders</Text>
        {TRACKS.map((t) => (
          <View key={t} style={styles.ladder}>
            <Text style={styles.ladderLabel}>{LADDERS[t].label}</Text>
            <Text style={styles.ladderTitles}>{LADDERS[t].titles.join('  →  ')}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  heading: { color: colors.text, fontSize: 22, fontWeight: '600', marginBottom: 12 },
  empty: { color: colors.muted, marginBottom: 12 },
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
