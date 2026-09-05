import { FamilyLink, FamilyLinkStatus, Role, User } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { generateInviteCode } from '../lib/inviteCodes';
import { AppError } from '../middleware/errorHandler';

const INVITE_CODE_TTL_MS = env.INVITE_CODE_TTL_MINUTES * 60_000;

/**
 * Short, human-readable 6-char invite code stored server-side with a TTL,
 * replacing the old stateless JWT (which was impractical to transcribe).
 * Codes survive server restarts (DB-backed) and expire after a few minutes.
 */
export async function createInvite(guardian: User): Promise<{ invite_code: string }> {
  // Opportunistic cleanup so expired rows don't accumulate.
  await prisma.familyLinkInvite.deleteMany({ where: { expires_at: { lt: new Date() } } });

  return { invite_code: await issueCodeForGuardian(guardian.id) };
}

async function issueCodeForGuardian(guardianUserId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    try {
      await prisma.familyLinkInvite.create({
        data: {
          code,
          guardian_user_id: guardianUserId,
          expires_at: new Date(Date.now() + INVITE_CODE_TTL_MS),
        },
      });
      return code;
    } catch (err) {
      // P2002 = unique code collision; retry with a fresh code.
      if ((err as { code?: string }).code === 'P2002') continue;
      throw err;
    }
  }
  throw new Error('Could not generate a unique invite code');
}

export async function acceptInvite(elder: User, inviteCode: string): Promise<FamilyLink> {
  // Be forgiving of transcription: lowercase and stray spaces are fine.
  const code = inviteCode.trim().toUpperCase();

  const invite = await prisma.familyLinkInvite.findUnique({ where: { code } });
  if (!invite) {
    throw new AppError(400, 'INVALID_INVITE_CODE', 'Invite code is invalid');
  }
  if (invite.expires_at.getTime() < Date.now()) {
    throw new AppError(400, 'INVALID_INVITE_CODE', 'Invite code has expired');
  }

  const guardian = await prisma.user.findUnique({ where: { id: invite.guardian_user_id } });
  if (!guardian || guardian.role !== Role.guardian) {
    throw new AppError(400, 'INVALID_INVITE_CODE', 'Invite code is invalid');
  }

  const existing = await prisma.familyLink.findFirst({
    where: { elder_user_id: elder.id, guardian_user_id: guardian.id },
  });
  if (existing) return existing;

  return prisma.familyLink.create({
    data: {
      elder_user_id: elder.id,
      guardian_user_id: guardian.id,
      status: FamilyLinkStatus.active,
    },
  });
}

export async function listForUser(user: User): Promise<FamilyLink[]> {
  return prisma.familyLink.findMany({
    where: {
      OR: [{ elder_user_id: user.id }, { guardian_user_id: user.id }],
    },
    include: { elder_user: true, guardian_user: true },
    orderBy: { created_at: 'desc' },
  });
}