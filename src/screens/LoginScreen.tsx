import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { isDemoMode } from '../lib/firebase';
import { colors } from '../theme';

export function LoginScreen() {
  const { signInDemo } = useAuth();

  const onGoogle = () => {
    if (isDemoMode) {
      signInDemo();
      return;
    }
    // TODO: open the Google sign-in prompt, then call
    // signInWithGoogleIdToken(idToken) from useAuth(). Needs a development build
    // (it does not work in Expo Go). See SETUP.md, "Google sign-in".
    Alert.alert('Google sign-in', 'Google sign-in is not connected yet. See SETUP.md.');
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.center}>
        <Logo size={220} wordmark tagline />
      </View>
      <View style={styles.bottom}>
        <Button label="Continue with Google" onPress={onGoogle} />
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
