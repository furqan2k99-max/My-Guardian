import { apiRequest } from './client';

export type PushPlatform = 'android' | 'ios' | 'web';

/** Upsert this device's push token (POST /api/v1/push/tokens). */
export function registerPushToken(
  token: string,
  pushToken: string,
  platform: PushPlatform,
): Promise<{ registered: boolean }> {
  return apiRequest<{ registered: boolean }>('/push/tokens', {
    method: 'POST',
    token,
    body: { token: pushToken, platform },
  });
}

/** Remove a registered push token (DELETE /api/v1/push/tokens/:token). */
export function unregisterPushToken(
  token: string,
  pushToken: string,
): Promise<{ registered: boolean }> {
  return apiRequest<{ registered: boolean }>(
    `/push/tokens/${encodeURIComponent(pushToken)}`,
    { method: 'DELETE', token },
  );
}