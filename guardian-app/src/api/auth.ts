import { apiRequest } from './client';
import type { DevLoginResponse, Role } from './types';

/**
 * Real login: sends a Firebase ID token (phone-auth session) to the backend,
 * which verifies it with the Admin SDK and issues a MyGuardian session.
 */
export function firebaseLogin(role: Role, idToken: string): Promise<DevLoginResponse> {
  return apiRequest<DevLoginResponse>('/auth/firebase-login', {
    method: 'POST',
    body: { role, id_token: idToken },
  });
}

/**
 * Dev-only login (backend stand-in for OAuth). Sends the SHA-256 hash of the
 * guardian's phone number — the backend never sees the raw number. Disabled
 * on the backend when NODE_ENV=production (the route is not even registered).
 */
export function devLogin(role: Role, phoneNumberHash: string): Promise<DevLoginResponse> {
  return apiRequest<DevLoginResponse>('/auth/dev-login', {
    method: 'POST',
    body: { role, phone_number_hash: phoneNumberHash },
  });
}