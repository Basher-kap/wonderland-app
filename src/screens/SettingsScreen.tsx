import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, TicketStub } from '../components';
import { useAuth } from '../context';
import { errorMessage } from '../lib/api';
import { myAvatarKey, pickAndSetMyAvatar, removeMyAvatar, useAvatar } from '../lib/avatars';
import { field, space, typo } from '../theme';

// Same rule as the server: 3-16 letters, numbers or underscores.
const USERNAME_RULE = /^[A-Za-z0-9_]{3,16}$/;

export function SettingsScreen() {
  const { uid, username, tickets, setUsername, signOut } = useAuth();
  const avatarKey = myAvatarKey(uid);
  const hasPicture = !!useAvatar(avatarKey);
  const [pictureBusy, setPictureBusy] = useState(false);
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

  const choosePicture = async () => {
    setPictureBusy(true);
    try {
      await pickAndSetMyAvatar(uid);
    } catch (e) {
      Alert.alert('Profile picture', errorMessage(e));
    } finally {
      setPictureBusy(false);
    }
  };

  const removePicture = async () => {
    setPictureBusy(true);
    try {
      await removeMyAvatar(uid);
    } catch (e) {
      Alert.alert('Profile picture', errorMessage(e));
    } finally {
      setPictureBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.heading}>Settings</Text>

        <View style={styles.pictureRow}>
          <Avatar uid={avatarKey} name={username} size={84} />
          <View style={styles.pictureButtons}>
            <Button tone="space" label={hasPicture ? 'Change picture' : 'Add picture'} onPress={choosePicture} disabled={pictureBusy} />
            {hasPicture && (
              <Button tone="space" label="Remove picture" variant="secondary" onPress={removePicture} disabled={pictureBusy} />
            )}
          </View>
        </View>

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
  pictureRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 10 },
  pictureButtons: { flex: 1, gap: 8 },
  label: { ...typo.body, fontSize: 15, fontWeight: '600' },
  input: { ...field, minHeight: 48, paddingHorizontal: 14, fontSize: 16 },
});