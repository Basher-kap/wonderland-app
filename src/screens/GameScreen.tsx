import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Button, DomainBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { getGame } from '../data/games';
import * as api from '../lib/api';
import { isDemoMode } from '../lib/firebase';
import { colors, radius } from '../theme';
import type { RootStackParamList } from '../navigation/types';

// PLACEHOLDER: rules per game are TBA, so this screen shows what the game is plus
// TEMPORARY host controls that let you finish rounds by hand and test the whole
// loop (lives, next game, tickets). Each game will become its own component.
export function GameScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Game'>>();
  const { uid } = useAuth();
  const [lobby, setLobby] = useState<api.LobbyDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const code = params.code;

  useEffect(() => {
    if (isDemoMode || !code) return;
    return api.subscribeLobby(code, setLobby, (e) => console.warn('lobby listener failed', e));
  }, [code]);

  const round = lobby?.currentRound ?? null;
  const game = getGame(round?.gameId ?? params.gameId);
  const isHost = !!lobby && lobby.hostId === uid;
  const finished = lobby?.status === 'finished';
  const roundActive = !finished && round?.status === 'active';
  const roundDone = !finished && round?.status === 'done';
  const players = lobby ? Object.entries<api.LobbyPlayer>(lobby.players) : [];
  const winnerName = lobby?.winnerId ? lobby.players[lobby.winnerId]?.username : undefined;

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (e) {
      Alert.alert('Game', api.errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!game) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.title}>Game not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.body}>
        <DomainBadge domain={game.domain} />
        <Text style={styles.title}>{game.name}</Text>
        <Text style={styles.desc}>{game.description}</Text>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>Rules</Text>
          <Text style={styles.boxText}>To be announced.</Text>
        </View>

        {lobby && (
          <View style={styles.box}>
            <Text style={styles.boxTitle}>
              Round {round?.no ?? '-'} · Leg {lobby.leg}
            </Text>
            {players.map(([id, p]) => (
              <Text key={id} style={styles.boxText}>
                {p.username}   ♥ {p.lives}
              </Text>
            ))}

            {finished && (
              <Text style={[styles.boxText, { marginTop: 8, color: colors.accent }]}>
                Match over.{winnerName ? ` Winner: ${winnerName}` : ''} Tickets update automatically.
              </Text>
            )}

            {roundActive && isHost && (
              <View style={{ gap: 8, marginTop: 10 }}>
                <Text style={styles.boxText}>
                  Temporary host controls (game boards are not built yet): who won this round?
                </Text>
                {players.map(([id, p]) => (
                  <Button
                    key={id}
                    label={p.username}
                    variant="secondary"
                    disabled={busy}
                    onPress={() => run(() => api.resolveRound(code!, id))}
                  />
                ))}
                <Button
                  label="Draw (nobody loses a life)"
                  variant="secondary"
                  disabled={busy}
                  onPress={() => run(() => api.resolveRound(code!, null))}
                />
              </View>
            )}
            {roundActive && !isHost && (
              <Text style={[styles.boxText, { marginTop: 8 }]}>Round in progress…</Text>
            )}

            {roundDone && isHost && (
              <Button
                label="Draw next game"
                disabled={busy}
                onPress={() => run(() => api.nextRound(code!))}
                style={{ marginTop: 10 }}
              />
            )}
            {roundDone && !isHost && (
              <Text style={[styles.boxText, { marginTop: 8 }]}>
                Round finished. Waiting for the host to draw the next game…
              </Text>
            )}
          </View>
        )}

        {!lobby && (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Game board goes here</Text>
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 20, gap: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  desc: { color: colors.muted, fontSize: 15 },
  box: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  boxTitle: { color: colors.text, fontWeight: '600', marginBottom: 4 },
  boxText: { color: colors.muted },
  placeholder: {
    height: 200,
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
