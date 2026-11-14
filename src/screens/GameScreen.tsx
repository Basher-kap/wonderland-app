import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Button, DomainBadge } from '../components/ui';
import { getGame } from '../data/games';
import { colors, radius } from '../theme';
import type { RootStackParamList } from '../navigation/types';

// PLACEHOLDER: rules per game are TBA, so this screen only shows what the game is.
// Each game will become its own component, picked by `gameId`.
export function GameScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Game'>>();
  const game = getGame(params.gameId);

  if (!game) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.title}>Game not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <View style={styles.body}>
        <DomainBadge domain={game.domain} />
        <Text style={styles.title}>{game.name}</Text>
        <Text style={styles.desc}>{game.description}</Text>

        <View style={styles.rules}>
          <Text style={styles.rulesTitle}>Rules</Text>
          <Text style={styles.rulesText}>To be announced.</Text>
        </View>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Game board goes here</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Button label="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: 20, gap: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  desc: { color: colors.muted, fontSize: 15 },
  rules: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rulesTitle: { color: colors.text, fontWeight: '600', marginBottom: 4 },
  rulesText: { color: colors.muted },
  placeholder: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: colors.muted },
  footer: { padding: 20 },
});
