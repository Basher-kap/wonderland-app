import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import * as api from '../lib/api';
import { auth, isDemoMode } from '../lib/firebase';

type AuthState = {
  loading: boolean;
  signedIn: boolean;
  uid: string | null;
  username: string;
  tickets: number;
  signInDemo: () => void;
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUsername: (name: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// Demo mode (no Firebase keys): everything lives in memory so you can click
// through the UI. With keys, the signed-in user's profile is read live from
// Firestore (users/{uid}) and changes go through Cloud Functions.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(!isDemoMode);
  const [demoSignedIn, setDemoSignedIn] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [username, setUsernameState] = useState('player_demo');
  const [tickets, setTickets] = useState(5);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (user) => {
      setUid(user ? user.uid : null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!uid) return;
    api.ensureProfile().catch((e) => console.warn('ensureProfile failed', e));
    return api.subscribeProfile(
      uid,
      (p) => {
        setUsernameState(p.username);
        setTickets(p.tickets);
      },
      (e) => console.warn('profile listener failed', e)
    );
  }, [uid]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      signedIn: demoSignedIn || uid !== null,
      uid,
      username,
      tickets,
      signInDemo: () => setDemoSignedIn(true),
      // The Google sign-in screen (see SETUP.md) gets an ID token from Google
      // and passes it here.
      signInWithGoogleIdToken: async (idToken) => {
        if (!auth) throw new Error('Firebase is not set up yet.');
        await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      },
      signOut: async () => {
        setDemoSignedIn(false);
        if (auth) await firebaseSignOut(auth);
      },
      setUsername: async (name) => {
        const clean = name.trim();
        if (isDemoMode) setUsernameState(clean);
        else await api.setUsername(clean); // the live profile listener updates the name
      },
    }),
    [loading, demoSignedIn, uid, username, tickets]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
