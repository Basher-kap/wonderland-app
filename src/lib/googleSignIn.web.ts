// Web version: the native Google sign-in library does not exist in a browser, and importing it
// would only break the web bundle. On the web the login screen uses Firebase's own Google popup
// (see AuthContext.signInWithGooglePopup), so this file only keeps the same exports.

export class GoogleSignInError extends Error {}

export async function getGoogleIdToken(): Promise<string | null> {
  throw new GoogleSignInError('On the web, sign in with the Google popup.');
}

export function googleErrorMessage(e: unknown): string {
  const code = (e as { code?: string } | null)?.code;
  if (code === 'auth/popup-blocked') return 'The browser blocked the Google popup. Allow popups for this site and try again.';
  if (code === 'auth/unauthorized-domain') {
    return 'This web address is not allowed in Firebase (Authentication > Settings > Authorized domains).';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'This sign-in method is not turned on in Firebase (Authentication > Sign-in method).';
  }
  const raw = e instanceof Error ? e.message : String(e ?? '');
  return raw || 'Sign-in failed. Please try again.';
}
