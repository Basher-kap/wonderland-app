import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Button } from '../components/ui';
import { VoiceButton } from '../components/VoiceButton';
import { voice } from '../voice/voice';
import { useAuth } from '../context/AuthContext';
import { GAMES } from '../data/games';
import * as api from '../lib/api';
import { isDemoMode } from '../lib/firebase';
import { colors } from '../theme';
import SpaceBackground from '../components/SpaceBackground';
import { SpaceHeader } from '../components/SpaceHeader';
import { listPanel, panel, rowDivider, space, typo } from '../spaceTheme';
import type { RootStackParamList } from '../navigation/types';

// Demo mode only: fake friends so the screen is not empty.
const DEMO_FRIENDS = ['Mad Hatter', 'Cheshire'];

type Row = { id: string; name: string; lives: number; isHost: boolean };

export function LobbyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Lobby'>>();
  const { uid, username } = useAuth();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused(); // the sky rests while a game is on top of the lobby
  const [lobby, setLobby] = useState<api.LobbyDoc | null>(null);
  const [busy, setBusy] = useState(false);

  // The voice chat belongs to this lobby: it keeps running while a game is played on top of this
  // screen, and stops when the lobby screen goes away.
  useEffect(() => {
    return () => {
      void voice.leaveLobby(params.code);
    };
  }, [params.code]);

  // Live lobby: players joining, lives, and the game the host's phone drew.
  useEffect(() => {
    if (isDemoMode) return;
    return api.subscribeLobby(params.code, setLobby, (e) => Alert.alert('Lobby', api.errorMessage(e)));
  }, [params.code]);

  // When a round starts, everyone in the lobby is taken to that game.
  const roundNo = lobby?.currentRound?.no;
  const roundGame = lobby?.currentRound?.gameId;
  const roundActive = lobby?.status === 'playing' && lobby.currentRound?.status === 'active';
  useEffect(() => {
    if (roundActive && roundGame) {
      navigation.navigate('Game', { gameId: roundGame, code: params.code, round: roundNo });
    }
  }, [roundActive, roundNo, roundGame, params.code, navigation]);

  // When the match ends, each player records their own result (tickets and scores).
  const finished = lobby?.status === 'finished';
  const matchId = lobby?.matchId;
  useEffect(() => {
    if (finished && matchId) {
      api.settleMatch(params.code).catch((e) => console.warn('settleMatch failed', e));
    }
  }, [finished, matchId, params.code]);

  const status = isDemoMode ? 'waiting' : lobby?.status ?? 'waiting';
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

  const winnerName = lobby?.winnerId ? lobby.players[lobby.winnerId]?.username : undefined;

  const start = async () => {
    if (isDemoMode) {
      const game = GAMES[Math.floor(Math.random() * GAMES.length)];
      navigation.navigate('Game', { gameId: game.id });
      return;
    }
    setBusy(true);
    try {
      await api.startLobby(params.code); // the host's phone draws the first game
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
    <SpaceBackground paused={!focused}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <SpaceHeader title="Lobby" onBack={() => navigation.goBack()} />
        <VoiceButton code={params.code} tone="space" style={{ top: insets.top + 6 }} />

        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Lobby ID</Text>
          <Text style={styles.code} accessibilityLabel={`Lobby ID ${params.code.split('').join(' ')}`}>
            {params.code}
          </Text>
          <Text style={styles.codeHint}>Share this with your friends so they can join.</Text>
        </View>

        <Text style={styles.heading}>Players ({rows.length})</Text>
        <View style={styles.table}>
          <FlatList
            data={rows}
            keyExtractor={(p) => p.id}
            ItemSeparatorComponent={Separator}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={styles.nameBox}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.isHost && (
                    <View style={styles.hostTag}>
                      <MaterialCommunityIcons name="crown-outline" size={14} color={space.amber} />
                      <Text style={styles.hostText}>host</Text>
                    </View>
                  )}
                </View>
                <View style={styles.livesBox} accessible accessibilityLabel={`${item.lives} lives`}>
                  <MaterialCommunityIcons name="heart" size={16} color={colors.chance} />
                  <Text style={styles.lives}>{item.lives}</Text>
                </View>
              </View>
            )}
          />
        </View>

        <View style={styles.footer}>
          {status === 'finished' ? (
            <Text style={styles.waiting}>Match finished.{winnerName ? ` Winner: ${winnerName}` : ''}</Text>
          ) : status === 'playing' ? (
            <Text style={styles.waiting}>Game in progress…</Text>
          ) : isHost ? (
            <Button tone="space" label="Start game" onPress={start} disabled={busy} />
          ) : (
            <Text style={styles.waiting}>Waiting for the host to start…</Text>
          )}
          <Button tone="space" label="Leave lobby" variant="secondary" onPress={leave} />
        </View>
      </SafeAreaView>
    </SpaceBackground>
  );
}

const Separator = () => <View style={rowDivider} />;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  codeBox: { ...panel, margin: 20, marginTop: 8, padding: 20, alignItems: 'center' },
  codeLabel: { ...typo.caption },
  code: {
    color: space.amber,
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: 8,
    marginVertical: 6,
    textShadowColor: 'rgba(239, 159, 39, 0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  codeHint: { ...typo.caption, fontSize: 12 },
  heading: { ...typo.heading, marginHorizontal: 20, marginBottom: 10 },
  table: { ...listPanel, marginHorizontal: 20, flexShrink: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  nameBox: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  name: { ...typo.body },
  hostTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  hostText: { color: space.amber, fontSize: 12 },
  livesBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lives: { color: colors.chance, fontSize: 16, fontWeight: '600' },
  footer: { padding: 20, gap: 10, marginTop: 'auto' },
  waiting: { ...typo.caption, textAlign: 'center' },
});