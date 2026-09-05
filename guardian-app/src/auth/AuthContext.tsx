import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ApiRequestError, currentIdToken, firebaseLogin, devLogin, listFamilyLinks } from '../api';
import { clearStoredToken, getStoredToken, setStoredToken } from './storage';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export const GUARDIAN_ROLE = 'guardian' as const;

interface AuthContextValue {
  status: AuthStatus;
  token: string | null;
  isPaired: boolean;
  /** Exchanges a verified Firebase ID token for a MyGuardian session. */
  signIn: (firebaseIdToken: string) => Promise<void>;
  /** Dev-only: signs in using a phone number hash (bypasses Firebase). */
  devSignIn: (phoneNumberHash: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshPairing: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [isPaired, setIsPaired] = useState(false);

  const recoverSession = useCallback(async (): Promise<string | null> => {
    // Silent renewal: the Firebase account stays signed in, so an expired
    // MyGuardian token can be exchanged for a fresh one without prompting.
    try {
      const idToken = await currentIdToken(true);
      if (!idToken) return null;
      const { token: fresh } = await firebaseLogin(GUARDIAN_ROLE, idToken);
      await setStoredToken(fresh);
      setToken(fresh);
      return fresh;
    } catch {
      return null;
    }
  }, []);

  const refreshPairing = useCallback(async () => {
    if (!token) return;
    try {
      const links = await listFamilyLinks(token);
      setIsPaired(links.some((link) => link.status === 'active'));
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        const recovered = await recoverSession();
        if (recovered) await refreshPairingRef.current?.();
        else {
          await clearStoredToken();
          setToken(null);
          setStatus('signedOut');
        }
      }
    }
  }, [token, recoverSession]);

  // Lets a 401 recovery re-run the pairing check without a self-reference.
  const refreshPairingRef = useRef<(() => Promise<void>) | null>(null);
  refreshPairingRef.current = refreshPairing;

  // Restore session on cold start.
  useEffect(() => {
    (async () => {
      const stored = await getStoredToken();
      if (!stored) {
        setStatus('signedOut');
        return;
      }
      setToken(stored);
      try {
        const links = await listFamilyLinks(stored);
        setIsPaired(links.some((link) => link.status === 'active'));
        setStatus('signedIn');
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) {
          // Expired MyGuardian token: renew from the still-signed-in Firebase
          // account instead of dropping the user to sign-in.
          const fresh = await recoverSession();
          if (fresh) {
            try {
              const links = await listFamilyLinks(fresh);
              setIsPaired(links.some((link) => link.status === 'active'));
              setStatus('signedIn');
              return;
            } catch {
              /* fall through to signed-out */
            }
          }
          await clearStoredToken();
          setStatus('signedOut');
          return;
        }
        // Backend unreachable — stay signed out rather than block on startup.
        setStatus('signedOut');
      }
    })();
  }, [recoverSession]);

  const signIn = useCallback(
    async (firebaseIdToken: string) => {
      const { token: newToken } = await firebaseLogin(GUARDIAN_ROLE, firebaseIdToken);
      await setStoredToken(newToken);
      setToken(newToken);
      const links = await listFamilyLinks(newToken);
      setIsPaired(links.some((link) => link.status === 'active'));
      setStatus('signedIn');
    },
    [],
  );

  const devSignIn = useCallback(
    async (phoneNumberHash: string) => {
      const { token: newToken } = await devLogin(GUARDIAN_ROLE, phoneNumberHash);
      await setStoredToken(newToken);
      setToken(newToken);
      const links = await listFamilyLinks(newToken);
      setIsPaired(links.some((link) => link.status === 'active'));
      setStatus('signedIn');
    },
    [],
  );

  const signOut = useCallback(async () => {
    await clearStoredToken();
    setToken(null);
    setIsPaired(false);
    setStatus('signedOut');
  }, []);

  const value = useMemo(
    () => ({ status, token, isPaired, signIn, devSignIn, signOut, refreshPairing }),
    [status, token, isPaired, signIn, devSignIn, signOut, refreshPairing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}