// Wraps the native Google sign-in library. That library contains native code, so it
// does not exist inside Expo Go: it is loaded only when the button is pressed, which
// keeps demo mode working in Expo Go. Real sign-in needs the development build
// (see GOOGLE_SIGNIN.md).

export class GoogleSignInError extends Error {}

let configured = false;

function loadLibrary() {
  try {
    return require('@react-native-google-signin/google-signin');
  } catch {
    throw new GoogleSignInError(
      'Google sign-in needs the Wonderland development build (it does not work in Expo Go). See GOOGLE_SIGNIN.md.'
    );
  }
}

// Returns a Google ID token, or null if the player closed the Google prompt.
export async function getGoogleIdToken(): Promise<string | null> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new GoogleSignInError('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing in your .env file.');
  }

  const { GoogleSignin, statusCodes } = loadLibrary();
  if (!configured) {
    GoogleSignin.configure({ webClientId });
    configured = true;
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    // Newer versions answer { type: 'success' | 'cancelled', data }, older ones return the user directly.
    if (response?.type === 'cancelled') return null;
    const idToken: string | undefined = response?.data?.idToken ?? response?.idToken;
    if (!idToken) {
      throw new GoogleSignInError('Google did not return an ID token. Check EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
    }
    return idToken;
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    if (code === statusCodes?.SIGN_IN_CANCELLED || code === statusCodes?.IN_PROGRESS) return null;
    throw e;
  }
}

// Friendly text for the most common failures.
export function googleErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? '');
  const code = (e as { code?: string } | null)?.code;
  if (e instanceof GoogleSignInError) return e.message;
  if (code === 'PLAY_SERVICES_NOT_AVAILABLE') return 'Google Play services are missing or out of date on this phone.';
  if (/DEVELOPER_ERROR|\b10\b/.test(`${code ?? ''} ${raw}`)) {
    return 'Google rejected this build. The SHA-1 fingerprint or package name in Firebase does not match this app. See GOOGLE_SIGNIN.md, step 6.';
  }
  if (/network/i.test(raw)) return 'Network problem. Check your connection and try again.';
  return raw || 'Google sign-in failed. Please try again.';
}
