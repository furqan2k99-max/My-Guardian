import { User } from '@prisma/client';
import { prisma } from '../db/prisma';
import { logger } from '../lib/logger';
import { sendFcmMessage } from '../providers/fcm';

export type PushPlatform = 'android' | 'ios' | 'web';

/** Registers (upserts by token) a device for push delivery. */
export async function registerDeviceToken(
  user: User,
  token: string,
  platform: PushPlatform,
): Promise<void> {
  await prisma.deviceToken.upsert({
    where: { token },
    create: { user_id: user.id, token, platform },
    update: { user_id: user.id, platform },
  });
}

export async function unregisterDeviceToken(user: User, token: string): Promise<void> {
  await prisma.deviceToken.deleteMany({ where: { user_id: user.id, token } });
}

export async function listDeviceTokens(user: User) {
  return prisma.deviceToken.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: 'desc' },
  });
}

/**
 * Sends a notification to every guardian with an active link to the given
 * elder, using each guardian's registered device tokens. Best-effort: no
 * FCM credentials, no tokens, or a failed send all log-and-skip rather than
 * failing the caller (the `flagged_event` row + `guardian_notified_at` seam
 * still records that notification was attempted).
 */
export async function notifyGuardiansOfEvent(
  elderUserId: string,
  message: { title: string; body: string; data: Record<string, string> },
): Promise<{ notifiedCount: number; skipped: boolean }> {
  const guardianships = await prisma.familyLink.findMany({
    where: { elder_user_id: elderUserId, status: 'active' },
    select: { guardian_user_id: true },
  });
  if (guardianships.length === 0) {
    return { notifiedCount: 0, skipped: true };
  }

  const tokens = await prisma.deviceToken.findMany({
    where: { user_id: { in: guardianships.map((link) => link.guardian_user_id) } },
    select: { token: true },
  });
  if (tokens.length === 0) {
    return { notifiedCount: 0, skipped: true };
  }

  const results = await Promise.allSettled(
    tokens.map(({ token }) => sendFcmMessage(token, message)),
  );
  const delivered = results.filter(
    (r): r is PromiseFulfilledResult<{ delivered: boolean }> =>
      r.status === 'fulfilled' && r.value.delivered,
  ).length;

  logger.info(
    { elderUserId, targets: tokens.length, delivered },
    'guardians push attempted for flagged event',
  );
  return { notifiedCount: delivered, skipped: delivered === 0 };
}