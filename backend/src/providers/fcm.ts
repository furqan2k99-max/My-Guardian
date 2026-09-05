import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { env } from '../config/env';
import { logger } from '../lib/logger';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri: string;
}

interface FcmResult {
  delivered: boolean;
  skipped?: boolean;
  reason?: string;
}

interface PushMessage {
  title: string;
  body: string;
  data: Record<string, string>;
}

let cachedAccount: ServiceAccount | null | undefined;

/**
 * Loads the Firebase service account once. `FCM_SERVICE_ACCOUNT_JSON` may be
 * either an inline JSON string or a path to a JSON file. Null when unset —
 * callers must degrade gracefully (log + skip), matching the Safe Browsing
 * "no vendor configured" pattern.
 */
function serviceAccount(): ServiceAccount | null {
  if (cachedAccount !== undefined) return cachedAccount;
  cachedAccount = null;
  const raw = env.FCM_SERVICE_ACCOUNT_JSON;
  try {
    const text = raw.trim().startsWith('{') ? raw : readFileSync(raw, 'utf8');
    cachedAccount = JSON.parse(text) as ServiceAccount;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'FCM service account unreadable — push disabled');
  }
  return cachedAccount;
}

function oauthToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: account.token_uri,
    iat: now,
    exp: now + 3600,
  };
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const signingInput = `${encode(header)}.${encode(claims)}`;
  const signature = createSign('RSA-SHA256')
    .update(signingInput)
    .sign(account.private_key, 'base64url');
  const assertion = `${signingInput}.${signature}`;

  return fetch(account.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
    .then((res) => res.json() as Promise<{ access_token?: string }>)
    .then((body) => {
      if (!body.access_token) throw new Error('OAuth token response missing access_token');
      return body.access_token;
    });
}

/** Sends a display notification via Firebase Cloud Messaging HTTP v1. */
export async function sendFcmMessage(
  deviceToken: string,
  message: PushMessage,
): Promise<FcmResult> {
  const account = serviceAccount();
  if (!account) {
    return { delivered: false, skipped: true, reason: 'no_service_account' };
  }
  if (!account.project_id) {
    return { delivered: false, skipped: true, reason: 'missing_project_id' };
  }

  try {
    const accessToken = await oauthToken(account);
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            // Data-ONLY delivery. A `notification` payload would make Android's
            // system tray show+handle the message itself, and tapping it would
            // launch the app with no reference to the event; data-only lets
            // expo-notifications post the local notification (from title/body
            // in `data`) and expose the tap to JS.
            data: message.data,
          },
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      logger.warn({ status: res.status, detail }, 'FCM send failed');
      return { delivered: false, reason: `fcm_http_${res.status}` };
    }
    return { delivered: true };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'FCM send threw');
    return { delivered: false, reason: 'fcm_exception' };
  }
}