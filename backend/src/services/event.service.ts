import {
  ElderAction,
  EventType,
  FlaggedEvent,
  GuardianAction,
  User,
} from '@prisma/client';
import { prisma } from '../db/prisma';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/errorHandler';
import { notifyGuardiansOfEvent } from './push.service';

export interface FlagEventInput {
  event_type: EventType;
  sender_hash: string;
  risk_score: number | null;
  risk_reasons: string[];
}

/**
 * Creates a flagged event and pushes a notification to the guardians of the
 * elder's active links. Push is best-effort: with no FCM credentials or no
 * registered device tokens it logs and skips (recorded via `guardian_notified_at`
 * and the alerts feed), never failing the request.
 */
export async function flagEvent(elder: User, input: FlagEventInput): Promise<FlaggedEvent> {
  const event = await prisma.flaggedEvent.create({
    data: {
      elder_user_id: elder.id,
      event_type: input.event_type,
      sender_hash: input.sender_hash,
      risk_score: input.risk_score,
      risk_reasons: input.risk_reasons,
    },
  });

  const guardians = await prisma.familyLink.findMany({
    where: { elder_user_id: elder.id, status: 'active' },
    select: { guardian_user_id: true },
  });

  if (guardians.length > 0) {
    await prisma.flaggedEvent.update({
      where: { id: event.id },
      data: { guardian_notified_at: new Date() },
    });

    const push = await notifyGuardiansOfEvent(elder.id, {
      title: 'MyGuardian alert',
      body: `A flagged ${input.event_type.toUpperCase()} from your elder needs your attention.`,
      data: {
        type: 'flagged_event',
        event_id: event.id,
        event_type: input.event_type,
        risk_score: input.risk_score?.toString() ?? 'unknown',
        // Data-only delivery (expo-notifications): the FCM message carries
        // everything in `data` — including these display keys — so expo's
        // Android service re-posts it as a local notification whose TAP is
        // observable in JS (system-tray notifications from a `notification`
        // payload would launch the app without any event reference).
        title: 'MyGuardian alert',
        body: `A flagged ${input.event_type.toUpperCase()} from your elder needs your attention.`,
      },
    });
    logger.info(
      {
        eventId: event.id,
        guardians: guardians.length,
        pushDelivered: push.notifiedCount,
        pushSkipped: push.skipped,
      },
      'guardians notified of flagged event',
    );
  }

  return prisma.flaggedEvent.findUniqueOrThrow({ where: { id: event.id } });
}

export async function listEvents(user: User) {
  if (user.role === 'guardian') {
    const guardianships = await prisma.familyLink.findMany({
      where: { guardian_user_id: user.id, status: 'active' },
      select: { elder_user_id: true },
    });
    const elderIds = guardianships.map((link) => link.elder_user_id);
    return prisma.flaggedEvent.findMany({
      where: { elder_user_id: { in: elderIds } },
      include: { elder_user: true },
      orderBy: { created_at: 'desc' },
    });
  }

  return prisma.flaggedEvent.findMany({
    where: { elder_user_id: user.id },
    orderBy: { created_at: 'desc' },
  });
}

export async function setElderAction(
  elder: User,
  eventId: string,
  action: ElderAction,
): Promise<FlaggedEvent> {
  const event = await prisma.flaggedEvent.findFirst({
    where: { id: eventId, elder_user_id: elder.id },
  });
  if (!event) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }

  return prisma.flaggedEvent.update({
    where: { id: eventId },
    data: { elder_action: action },
  });
}

/**
 * Fetches a single event. The linked guardian and the event's own elder may
 * both read it; other guardians (even of other elders) may not.
 */
export async function getEventForUser(user: User, eventId: string): Promise<FlaggedEvent> {
  const event = await prisma.flaggedEvent.findUnique({
    where: { id: eventId },
    include: { elder_user: true },
  });
  if (!event) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }

  if (user.role === 'elder' && event.elder_user_id !== user.id) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }
  if (user.role === 'guardian') {
    const link = await prisma.familyLink.findFirst({
      where: {
        guardian_user_id: user.id,
        elder_user_id: event.elder_user_id,
        status: 'active',
      },
    });
    if (!link) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found');
    }
  }

  return event;
}

/**
 * Guardian review of a flagged event from their linked elder. Records which
 * way they ruled (reviewed / dismissed) and when.
 */
export async function reviewEvent(
  guardian: User,
  eventId: string,
  action: GuardianAction,
): Promise<FlaggedEvent> {
  const event = await prisma.flaggedEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }

  const link = await prisma.familyLink.findFirst({
    where: {
      guardian_user_id: guardian.id,
      elder_user_id: event.elder_user_id,
      status: 'active',
    },
  });
  if (!link) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }

  return prisma.flaggedEvent.update({
    where: { id: eventId },
    data: { guardian_action: action, guardian_reviewed_at: new Date() },
  });
}
