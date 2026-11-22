import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLogo, Button, SpaceBackground, useReduceMotion } from '../components';
import { useAuth } from '../context';
import { isDemoMode } from '../lib/firebase';
import { getGoogleIdToken, googleErrorMessage } from '../lib/googleSignIn';
import { space } from '../theme';

const isWeb = Platform.OS === 'web';

// The emblem comes out of the dark: it fades and settles in, then a halo of violet light behind it breathes slowly.
function Emblem({ children }: { children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const enter = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      enter.setValue(1);
      return;
    }
    Animated.timing(enter, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, enter, breath]);
  const halo = 340;
  return (
    <Animated.View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        opacity: enter,
        transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }],
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: halo,
          height: halo,
          opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
          transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.08] }) }],
        }}
      >
        <Svg width={halo} height={halo}>
          <Defs>
            <RadialGradient id="login-halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0.3" stopColor="#9B6BFF" stopOpacity="0.28" />
              <Stop offset="0.62" stopColor="#9B6BFF" stopOpacity="0.08" />
              <Stop offset="1" stopColor="#9B6BFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={halo / 2} cy={halo / 2} r={halo / 2} fill="url(#login-halo)" />
        </Svg>
      </Animated.View>
      {children}
    </Animated.View>
  );
}

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
    <SpaceBackground>
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <Emblem>
            <AppLogo size={230} wordmark tagline />
          </Emblem>
        </View>
        <View style={styles.bottom}>
          <Button
            tone="space"
            label={busy ? 'Signing in…' : 'Continue with Google'}
            onPress={onGoogle}
            disabled={busy}
          />
          {isWeb && !isDemoMode && (
            <Button
              tone="space"
              label="Guest player (testing, this tab only)"
              variant="secondary"
              onPress={onGuest}
              disabled={busy}
            />
          )}
          <Text style={styles.note}>
            {isDemoMode
              ? 'Demo mode: no Firebase keys found, so nothing is saved.'
              : 'Sign in to get your 5 starting tickets.'}
          </Text>
        </View>
      </SafeAreaView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', padding: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { gap: 12, paddingBottom: 16 },
  note: { color: space.textDim, textAlign: 'center', fontSize: 13 },
});
