import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, TicketChip } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/api';
import { colors, radius } from '../theme';
import SpaceBackground from '../components/SpaceBackground';
import { space } from '../spaceTheme';

// Same rule as the server: 3-16 letters, numbers or underscores.
const USERNAME_RULE = /^[A-Za-z0-9_]{3,16}$/;

export function SettingsScreen() {
  const { username, tickets, setUsername, signOut } = useAuth();
  const [draft, setDraft] = useState(username);
  const [saving, setSaving] = useState(false);

  // The profile loads a moment after sign-in; keep the box in sync with it.
  useEffect(() => setDraft(username), [username]);

  const save = async () => {
    const clean = draft.trim();
    if (!USERNAME_RULE.test(clean)) {
      Alert.alert('Username', 'Use 3-16 letters, numbers or underscores.');
      return;
    }
    setSaving(true);
    try {
      await setUsername(clean);
      Alert.alert('Saved', 'Your username was updated.');
    } catch (e) {
      Alert.alert('Username', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SpaceBackground>
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.heading}>Settings</Text>

        <Text style={styles.label}>Username</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={16}
          style={styles.input}
        />
        <Button label="Save username" onPress={save} disabled={saving} />

        <View style={styles.ticketRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label}>Tickets</Text>
            <Text style={styles.hint}>You need 1 to play. Win a match to earn one.</Text>
          </View>
          <TicketChip tickets={tickets} />
        </View>

        <Button label="Sign out" variant="secondary" onPress={() => signOut()} style={{ marginTop: 24 }} />
      </View>
    </SafeAreaView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, gap: 10 },
  heading: { color: colors.text, fontSize: 22, fontWeight: '600', marginBottom: 8 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 12, marginTop: 2 },
  input: {
    backgroundColor: space.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    color: colors.text,
    fontSize: 16,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: space.card,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
