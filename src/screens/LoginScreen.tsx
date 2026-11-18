import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { isDemoMode } from '../lib/firebase';
import { getGoogleIdToken, googleErrorMessage } from '../lib/googleSignIn';
import { colors } from '../theme';

const isWeb = Platform.OS === 'web';

export function LoginScreen() {
  const { signInDemo, signInWithGoogleIdToken, signInWithGooglePopup, signInAsGuest } = useAuth();
  const [busy, setBusy] = useState(false);

  const onGoogle = async () => {
    if (isDemoMode) {
      signInDemo();
      return;
    }
    setBusy(true);
    try {
      if (isWeb) {
        await signInWithGooglePopup();
        return;
      }
      const idToken = await getGoogleIdToken();
      if (!idToken) return; // the player closed the Google prompt
      // Firebase now knows the player; the app moves to the home screen on its own.
      await signInWithGoogleIdToken(idToken);
    } catch (e) {
      if ((e as { code?: string } | null)?.code === 'auth/popup-closed-by-user') return;
      Alert.alert('Google sign-in', googleErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Web only, for testing with several tabs: a throw-away guest player (needs "Anonymous" to be
  // turned on in Firebase > Authentication > Sign-in method).
  const onGuest = async () => {
    setBusy(true);
    try {
      await signInAsGuest();
    } catch (e) {
      Alert.alert('Guest sign-in', googleErrorMessage(e));
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
        {isWeb && !isDemoMode && (
          <Button label="Guest player (testing, this tab only)" variant="secondary" onPress={onGuest} disabled={busy} />
        )}
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
