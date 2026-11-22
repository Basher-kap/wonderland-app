import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, NavigationContainer, createNavigationContainerRef, useIsFocused } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context';
import { colors, space } from './src/theme';
import type { RootStackParamList, TabParamList } from './src/navigation';
import { ChatBubble, GameHeader, SpaceBackground, SpaceTabBar } from './src/components';
import {
  GameScreen,
  HomeScreen,
  LeaderboardScreen,
  LobbyScreen,
  LoginScreen,
  SettingsScreen,
} from './src/screens';

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

// Home, Leaderboard and Settings share ONE night sky, drawn here behind the whole tab navigator. The pages
// and the tab bar are see-through (sceneStyle), so the stars never jump when you switch tabs and run
// behind the tab bar too. The tab icons, labels and the active star live in src/components/space/SpaceTabBar.tsx.
// The sky rests while another screen (Lobby, Game) is on top.
function MainTabs() {
  const focused = useIsFocused();
  return (
    <SpaceBackground paused={!focused}>
      <Tabs.Navigator
        tabBar={(props) => <SpaceTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
      >
        <Tabs.Screen name="Home" component={HomeScreen} />
        <Tabs.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Leaderboard' }} />
        <Tabs.Screen name="Settings" component={SettingsScreen} />
      </Tabs.Navigator>
    </SpaceBackground>
  );
}

// Header of the Game screen: pure black like the night sky, starlight title and back arrow, no divider.
// The games keep their own look below the header; only this bar and the mic pill follow the Space theme.
// (The Lobby has no native header: it draws its own, on the sky.)
const spaceHeader = {
  headerStyle: { backgroundColor: space.void },
  headerShadowVisible: false,
  headerTintColor: space.text,
  headerTitleStyle: { fontWeight: '600' as const, color: space.text },
};

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
    <Stack.Navigator screenOptions={spaceHeader}>
      {signedIn ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Lobby" component={LobbyScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="Game"
            component={GameScreen}
            options={{ title: 'Game', header: (props) => <GameHeader {...props} /> }}
          />
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