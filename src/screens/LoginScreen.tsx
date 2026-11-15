import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { isDemoMode } from '../lib/firebase';
import { getGoogleIdToken, googleErrorMessage } from '../lib/googleSignIn';
import { colors } from '../theme';

export function LoginScreen() {
  const { signInDemo, signInWithGoogleIdToken } = useAuth();
  const [busy, setBusy] = useState(false);

  const onGoogle = async () => {
    if (isDemoMode) {
      signInDemo();
      return;
    }
    setBusy(true);
    try {
      const idToken = await getGoogleIdToken();
      if (!idToken) return; // the player closed the Google prompt
      // Firebase now knows the player; the app moves to the home screen on its own.
      await signInWithGoogleIdToken(idToken);
    } catch (e) {
      Alert.alert('Google sign-in', googleErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.center}>
        <Logo size={220} wordmark tagline />
      </View>
      <View style={styles.bottom}>
        <Button label={busy ? 'Signing in…' : 'Continue with Google'} onPress={onGoogle} disabled={busy} />
        <Text style={styles.note}>
          {isDemoMode
            ? 'Demo mode: no Firebase keys found, so nothing is saved.'
            : 'Sign in to get your 5 starting tickets.'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { gap: 12, paddingBottom: 16 },
  note: { color: colors.muted, textAlign: 'center', fontSize: 13 },
});
