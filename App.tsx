import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { colors } from './src/theme';
import type { RootStackParamList, TabParamList } from './src/navigation/types';
import { ChatBubble } from './src/components/ChatBubble';
import { SpaceTabBar } from './src/components/SpaceTabBar';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { GameScreen } from './src/screens/GameScreen';

const navRef = createNavigationContainerRef<RootStackParamList>();

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.card,
    border: colors.border,
    text: colors.text,
    primary: colors.accent,
  },
};

// The tab bar itself (icons, colours, glow) lives in components/SpaceTabBar.tsx.
function MainTabs() {
  return (
    <Tabs.Navigator tabBar={(props) => <SpaceTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

// Which screens exist depends on whether the player is signed in, so signing
// in or out moves them to the right place automatically.
function RootNavigator() {
  const { loading, signedIn } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator>
      {signedIn ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          {/* The lobby draws its own space background edge to edge, so it has no header bar. */}
          <Stack.Screen name="Lobby" component={LobbyScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Game" component={GameScreen} options={{ title: 'Game' }} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [routeName, setRouteName] = useState<string | undefined>();
  const track = () => setRouteName(navRef.getCurrentRoute()?.name);
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navRef} theme={navTheme} onReady={track} onStateChange={track}>
          <StatusBar style="light" />
          <RootNavigator />
          <ChatBubble navRef={navRef} routeName={routeName} />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
