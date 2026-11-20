import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Logo } from '../components/Logo';
import { Button, DomainIcon, TicketChip } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { GAMES } from '../data/games';
import * as api from '../lib/api';
import { isDemoMode } from '../lib/firebase';
import { colors, DOMAIN_ORDER, domainInfo, radius } from '../theme';
import SpaceBackground from '../components/SpaceBackground';
import { space } from '../spaceTheme';
import type { RootStackParamList } from '../navigation/types';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () =>
  Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { username, tickets } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const createLobby = async () => {
    setBusy(true);
    try {
      const newCode = isDemoMode ? randomCode() : await api.createLobby();
      navigation.navigate('Lobby', { code: newCode, host: true });
    } catch (e) {
      Alert.alert('Could not create lobby', api.errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const joinLobby = async () => {
    const clean = code.trim().toUpperCase();
    if (clean.length < 6) {
      Alert.alert('Lobby ID', 'Enter the 6-character lobby ID from your host.');
      return;
    }
    setBusy(true);
    try {
      if (!isDemoMode) await api.joinLobby(clean);
      navigation.navigate('Lobby', { code: clean, host: false });
    } catch (e) {
      Alert.alert('Could not join lobby', api.errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SpaceBackground>
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Logo size={44} />
            <View>
              <Text style={styles.hello}>Hi, {username}</Text>
              <Text style={styles.sub}>Ready to play?</Text>
            </View>
          </View>
          <TicketChip tickets={tickets} />
        </View>

        <View style={styles.panel}>
          <Button label="Create lobby" onPress={createLobby} disabled={busy} />
          <View style={styles.joinRow}>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Lobby ID"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              style={styles.input}
            />
            <Button
              label="Join"
              variant="secondary"
              onPress={joinLobby}
              disabled={busy}
              style={{ paddingHorizontal: 24 }}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Games</Text>
        {DOMAIN_ORDER.map((domain) => {
          const info = domainInfo[domain];
          return (
            <View key={domain} style={{ marginBottom: 18 }}>
              <View style={styles.domainHeader}>
                <DomainIcon domain={domain} size={22} />
                <Text style={[styles.domainTitle, { color: info.color }]}>{info.label}</Text>
              </View>
              <Text style={styles.domainBlurb}>{info.blurb}</Text>
              {GAMES.filter((g) => g.domain === domain).map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => navigation.navigate('Game', { gameId: g.id })}
                  style={({ pressed }) => [styles.gameCard, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.gameName}>{g.name}</Text>
                  <Text style={styles.gameDesc}>{g.description}</Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hello: { color: colors.text, fontSize: 17, fontWeight: '600' },
  sub: { color: colors.muted, fontSize: 13 },
  panel: {
    backgroundColor: space.card,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  joinRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: space.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
    letterSpacing: 2,
  },
  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: '600', marginBottom: 12 },
  domainHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  domainTitle: { fontSize: 18, fontWeight: '600' },
  domainBlurb: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  gameCard: {
    backgroundColor: space.card,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gameName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  gameDesc: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
