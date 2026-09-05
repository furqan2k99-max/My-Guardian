import { readFileSync } from 'node:fs';
import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import { env } from '../config/env';
import { logger } from '../lib/logger';

/**
 * Firebase Auth verification backed by the Admin SDK. Reuses the same
 * Firebase service account as FCM (single project: `myguardian-1aa01`), so
 * no new credential is needed. Configured via FIREBASE_SERVICE_ACCOUNT_JSON
 * (falls back to FCM_SERVICE_ACCOUNT_JSON for the shared setup).
 *
 * The SDK is loaded LAZILY (dynamic import inside ensureFirebase): a missing
 * credential disables Firebase token verification (fail-closed, logged once)
 * rather than crashing, mirroring the push provider's "no vendor configured"
 * pattern — and the heavy ESM dependency chain never loads in unit tests or
 * when verification is simply not used.
 */
type FirebaseState =
  | { status: 'uninitialized' }
  | { status: 'ready'; app: App; auth: Auth }
  | { status: 'disabled' };

let firebaseState: FirebaseState = { status: 'uninitialized' };
let initLogged = false;

interface ServiceAccountJson {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

function serviceAccountJson(): string {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return '';
  try {
    return raw.trim().startsWith('{') ? raw : readFileSync(raw, 'utf8');
  } catch {
    return '';
  }
}

async function ensureFirebase(): Promise<Auth | null> {
  if (firebaseState.status === 'ready') return firebaseState.auth;
  if (firebaseState.status === 'disabled') return null;

  const raw = serviceAccountJson();
  if (!raw) {
    if (!initLogged) {
      logger.warn('Firebase service account unset — Firebase ID token verification disabled');
      initLogged = true;
    }
    firebaseState = { status: 'disabled' };
    return null;
  }

  try {
    const account = JSON.parse(raw) as ServiceAccountJson;
    if (!account.project_id || !account.private_key || !account.client_email) {
      throw new Error('Firebase service account missing project_id/private_key/client_email');
    }
    // Dynamic import keeps firebase-admin out of the module graph until the
    // first real verification (see class comment).
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    let app = getApps()[0];
    if (!app) {
      app = initializeApp({
        // cert() accepts the parsed service-account object — not raw JSON content.
        credential: cert({
          projectId: account.project_id,
          clientEmail: account.client_email,
          privateKey: account.private_key,
        }),
      });
    }
    const { getAuth } = await import('firebase-admin/auth');
    const auth = getAuth(app);
    firebaseState = { status: 'ready', app, auth };
    return auth;
  } catch (err) {
    if (!initLogged) {
      logger.warn(
        { err: (err as Error).message },
        'Firebase Admin SDK init failed — token verification disabled',
      );
      initLogged = true;
    }
    firebaseState = { status: 'disabled' };
    return null;
  }
}

export interface VerifiedFirebaseToken {
  uid: string;
  email: string | null;
}

/**
 * Verifies a Firebase ID token (signed by Google's certificates) and returns
 * the verified identity. Throws if the token is invalid, expired, or if
 * Firebase verification is not configured (callers treat that as 401/503).
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseToken> {
  const auth = await ensureFirebase();
  if (!auth) {
    throw new Error('Firebase token verification is not configured');
  }
  const decoded = await auth.verifyIdToken(idToken);
  return { uid: decoded.uid, email: decoded.email ?? null };
}