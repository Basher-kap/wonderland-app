import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Must match the region the Cloud Functions are deployed to (backend/functions/src/index.ts).
export const FUNCTIONS_REGION = 'asia-southeast1';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// While the keys are missing the app runs in demo mode (no network calls).
export const isDemoMode = !config.apiKey || !config.projectId || !config.appId;

const app: FirebaseApp | null = isDemoMode ? null : getApps().length ? getApp() : initializeApp(config);

function makeAuth(a: FirebaseApp) {
  try {
    return initializeAuth(a, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Already initialized (happens on fast refresh).
    return getAuth(a);
  }
}

export const auth = app ? makeAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const functions = app ? getFunctions(app, FUNCTIONS_REGION) : null;
