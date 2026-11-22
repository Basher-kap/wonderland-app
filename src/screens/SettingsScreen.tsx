import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, TicketStub } from '../components';
import { useAuth } from '../context';
import { errorMessage } from '../lib/api';
import { field, space, typo } from '../theme';

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
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.heading}>Settings</Text>

        <Text style={styles.label}>Username</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          accessibilityLabel="Username"
          placeholderTextColor={space.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={16}
          style={styles.input}
        />
        <Button tone="space" label="Save username" onPress={save} disabled={saving} />

        <View style={{ marginTop: 18 }}>
          <TicketStub tickets={tickets} title="Tickets" hint="You need 1 to play. Win a match to earn one." />
        </View>

        <Button tone="space" label="Sign out" variant="secondary" onPress={() => signOut()} style={{ marginTop: 28 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, gap: 10 },
  heading: { ...typo.title, marginBottom: 10 },
  label: { ...typo.body, fontSize: 15, fontWeight: '600' },
  input: { ...field, minHeight: 48, paddingHorizontal: 14, fontSize: 16 },
});