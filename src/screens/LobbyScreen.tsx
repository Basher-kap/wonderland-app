import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { GAMES } from '../data/games';
import * as api from '../lib/api';
import { isDemoMode } from '../lib/firebase';
import { colors, radius } from '../theme';
import type { RootStackParamList } from '../navigation/types';

// Demo mode only: fake friends so the screen is not empty.
const DEMO_FRIENDS = ['Mad Hatter', 'Cheshire'];

type Row = { id: string; name: string; lives: number; isHost: boolean };

export function LobbyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Lobby'>>();
  const { uid, username } = useAuth();
  const [lobby, setLobby] = useState<api.LobbyDoc | null>(null);
  const [busy, setBusy] = useState(false);

  // Live lobby: players joining, lives, and the game the server picked.
  useEffect(() => {
    if (isDemoMode) return;
    return api.subscribeLobby(
      params.code,
      setLobby,
      (e) => Alert.alert('Lobby', api.errorMessage(e))
    );
  }, [params.code]);

  // When the server starts a round, everyone in the lobby is taken to that game.
  const roundNo = lobby?.currentRound?.no;
  const roundGame = lobby?.currentRound?.gameId;
  const roundActive = lobby?.status === 'playing' && lobby.currentRound?.status === 'active';
  useEffect(() => {
    if (roundActive && roundGame) navigation.navigate('Game', { gameId: roundGame });
  }, [roundActive, roundNo, roundGame, navigation]);

  const isHost = isDemoMode ? params.host : lobby?.hostId === uid;

  const rows: Row[] = isDemoMode
    ? [username, ...DEMO_FRIENDS].map((name, i) => ({
        id: String(i),
        name,
        lives: 10,
        isHost: i === 0 ? params.host : !params.host && i === 1,
      }))
    : Object.entries<api.LobbyPlayer>(lobby?.players ?? {})
        .map(([id, p]) => ({ id, name: p.username, lives: p.lives, isHost: lobby?.hostId === id }))
        .sort((a, b) => a.name.localeCompare(b.name));

  const start = async () => {
    if (isDemoMode) {
      const game = GAMES[Math.floor(Math.random() * GAMES.length)];
      navigation.navigate('Game', { gameId: game.id });
      return;
    }
    setBusy(true);
    try {
      await api.startLobby(params.code); // the server draws the first game
    } catch (e) {
      Alert.alert('Could not start', api.errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    try {
      if (!isDemoMode) await api.leaveLobby(params.code);
    } catch (e) {
      console.warn('leaveLobby failed', e);
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>Lobby ID</Text>
        <Text style={styles.code}>{params.code}</Text>
        <Text style={styles.codeHint}>Share this with your friends so they can join.</Text>
      </View>

      <Text style={styles.heading}>Players ({rows.length})</Text>
      <FlatList
        data={rows}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>
              {item.name}
              {item.isHost ? '  (host)' : ''}
            </Text>
            <Text style={styles.lives}>♥ {item.lives}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        {isHost ? (
          <Button label="Start game" onPress={start} disabled={busy} />
        ) : (
          <Text style={styles.waiting}>Waiting for the host to start…</Text>
        )}
        <Button label="Leave lobby" variant="secondary" onPress={leave} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  codeBox: {
    margin: 20,
    padding: 20,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeLabel: { color: colors.muted, fontSize: 13 },
  code: { color: colors.accent, fontSize: 40, fontWeight: '700', letterSpacing: 6, marginVertical: 4 },
  codeHint: { color: colors.muted, fontSize: 12 },
  heading: { color: colors.text, fontSize: 18, fontWeight: '600', marginHorizontal: 20, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { color: colors.text, fontSize: 16 },
  lives: { color: colors.chance, fontSize: 16, fontWeight: '600' },
  footer: { padding: 20, gap: 10 },
  waiting: { color: colors.muted, textAlign: 'center' },
});
