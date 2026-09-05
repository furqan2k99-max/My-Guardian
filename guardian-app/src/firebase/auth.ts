import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
} from '@react-native-firebase/auth';

/**
 * Email/password helpers for the guardian app (RNFirebase v26 modular API).
 * We authenticate with Firebase and exchange the resulting ID token for a
 * MyGuardian session at POST /auth/firebase-login.
 */

/** Creates the Firebase account and returns its ID token. */
export async function signUpWithEmail(email: string, password: string): Promise<string> {
  const credential = await createUserWithEmailAndPassword(
    getAuth(),
    email.trim(),
    password,
  );
  return credential.user.getIdToken();
}

/** Signs in to an existing Firebase account and returns its ID token. */
export async function signInWithEmail(email: string, password: string): Promise<string> {
  const credential = await signInWithEmailAndPassword(getAuth(), email.trim(), password);
  return credential.user.getIdToken();
}

/**
 * A freshly minted Firebase ID token for the still-signed-in account, or null
 * when there is no Firebase session. Used to silently renew a MyGuardian
 * session after its access token expires.
 */
export async function currentIdToken(forceRefresh = false): Promise<string | null> {
  const user = getAuth().currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

/** Friendly copy for common Firebase email/password errors. */
export function describeAuthError(err: unknown): string {
  if (err instanceof Error) {
    switch (err.code) {
      case 'auth/invalid-email':
        return 'That email address doesn\u2019t look right.';
      case 'auth/email-already-in-use':
        return 'That email already has an account \u2014 try signing in instead.';
      case 'auth/weak-password':
        return 'Please choose a stronger password (at least 6 characters).';
      case 'auth/missing-password':
        return 'Please enter your password.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email or password didn\u2019t match an account.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a few minutes and try again.';
      case 'auth/network-request-failed':
        return 'Couldn\u2019t reach MyGuardian. Check your connection and try again.';
      default:
        return err.message;
    }
  }
  return 'Something went wrong. Please try again.';
}