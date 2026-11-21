import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Logo } from '../components/Logo';
import { Button, DomainIcon, TicketChip } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { GAMES } from '../data/games';
import * as api from '../lib/api';
import { isDemoMode } from '../lib/firebase';
import { DOMAIN_ORDER, domainInfo } from '../theme';
import { field, listPanel, panel, rowDivider, space, typo } from '../spaceTheme';
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
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
          <Button tone="space" label="Create lobby" onPress={createLobby} disabled={busy} />
          <View style={styles.joinRow}>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Lobby ID"
              placeholderTextColor={space.textFaint}
              accessibilityLabel="Lobby ID"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              style={styles.input}
            />
            <Button
              tone="space"
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
          const games = GAMES.filter((g) => g.domain === domain);
          return (
            <View key={domain} style={styles.domain}>
              <View style={styles.domainHeader}>
                <DomainIcon domain={domain} size={22} />
                <Text style={[styles.domainTitle, { color: info.color }]}>{info.label}</Text>
              </View>
              <Text style={styles.domainBlurb}>{info.blurb}</Text>
              <View style={styles.list}>
                {games.map((g, i) => (
                  <Pressable
                    key={g.id}
                    onPress={() => navigation.navigate('Game', { gameId: g.id })}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.gameRow,
                      i < games.length - 1 && rowDivider,
                      pressed && { backgroundColor: space.pressedBg },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gameName}>{g.name}</Text>
                      <Text style={styles.gameDesc}>{g.description}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={space.textFaint} />
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, paddingBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hello: { ...typo.heading },
  sub: { ...typo.caption },
  panel: { ...panel, padding: 16, gap: 12, marginBottom: 28 },
  joinRow: { flexDirection: 'row', gap: 10 },
  input: { ...field, flex: 1, minHeight: 48, paddingHorizontal: 14, fontSize: 16, letterSpacing: 3 },
  sectionTitle: { ...typo.title, marginBottom: 14 },
  domain: { marginBottom: 24 },
  domainHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  domainTitle: { fontSize: 18, fontWeight: '600', letterSpacing: 0.15 },
  domainBlurb: { ...typo.caption, marginTop: 2, marginBottom: 10 },
  list: { ...listPanel },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 16 },
  gameName: { ...typo.body, fontWeight: '600' },
  gameDesc: { ...typo.caption, marginTop: 2 },
});