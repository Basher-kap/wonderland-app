import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppLogo } from '../components/AppLogo';
import { Button, DomainIcon, TicketChip } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';
import { isDemoMode } from '../lib/firebase';
import { DOMAIN_ORDER, Domain, domainInfo } from '../theme';
import { field, panel, space, typo } from '../spaceTheme';
import type { RootStackParamList } from '../navigation/types';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () =>
  Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

// What each domain is about, in the words of the game's own brief.
const ABOUT: Record<Domain, string> = {
  logic: 'Games of critical thinking and pure analysis, where every challenge can be solved by reasoning it through.',
  experience:
    'Games that draw on what you have observed and gathered: worldly awareness, great ideas and a keen visual sense.',
  chance: 'Games far from reasoning, ruled by randomness, probability and luck.',
};

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
            <AppLogo size={46} />
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

        <Text style={styles.sectionTitle}>Domains</Text>
        {DOMAIN_ORDER.map((domain) => {
          const info = domainInfo[domain];
          
          return (
            <View key={domain} style={[styles.domain, { borderTopColor: info.color + '99' }]}>
              <View style={styles.domainHeader}>
                <View style={[styles.orb, { borderColor: info.color, shadowColor: info.color }]}>
                  <DomainIcon domain={domain} size={26} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.domainTitle, { color: info.color }]}>{info.label}</Text>
                </View>
              </View>
              <Text style={styles.domainText}>{ABOUT[domain]}</Text>
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
  domain: { ...panel, borderTopWidth: 2, padding: 16, marginBottom: 16, gap: 10 },
  domainHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  domainTitle: { fontSize: 20, fontWeight: '700', letterSpacing: 0.15 },
  domainText: { ...typo.body, fontSize: 15, lineHeight: 22, color: space.textDim },
});
