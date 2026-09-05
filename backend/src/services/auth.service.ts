import { Role, User } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { hashIdentifier } from '../lib/hash';
import { signAccessToken } from '../lib/tokens';
import { AppError } from '../middleware/errorHandler';
import { verifyFirebaseIdToken } from '../providers/firebaseAuth';

/**
 * Dev-only auth stand-in. A real deployment verifies the provider's
 * identity token (Firebase Auth / Auth0 / OAuth) and maps it onto a
 * `users` row instead; this keeps the local/CI loop running without
 * external credentials.
 */
export async function devLogin(
  role: Role,
  phoneNumberHash: string,
): Promise<{ token: string; user: User }> {
  if (env.NODE_ENV === 'production') {
    throw new AppError(403, 'AUTH_DEV_DISABLED', 'Dev login is disabled in production');
  }

  let user = await prisma.user.findFirst({
    where: { role, phone_number_hash: phoneNumberHash },
  });

  if (!user) {
    user = await prisma.user.create({
      data: { role, phone_number_hash: phoneNumberHash },
    });
  }

  const token = signAccessToken(user.id, user.role);
  return { token, user };
}

/**
 * Real login path. Verifies a Firebase ID token (email/password today;
 * phone-auth may return later), then creates-or-matches a `users` row keyed
 * by the server-side hash of the VERIFIED email from the token — never a
 * client-supplied identity. The `email` claim is trusted because Firebase
 * only issues it for the account that completed the provider flow.
 *
 * Migration note: rows created by dev-login keep their client-supplied
 * `phone_number_hash`; they simply never match real logins. The column now
 * stores the hash of the verified email for auth users (role still scopes it,
 * so one Firebase account can act as both elder and guardian in tests).
 */
export async function firebaseLogin(
  role: Role,
  idToken: string,
): Promise<{ token: string; user: User }> {
  let verified: { uid: string; email: string | null };
  try {
    verified = await verifyFirebaseIdToken(idToken);
  } catch (err) {
    throw new AppError(
      401,
      'INVALID_TOKEN',
      `Firebase token could not be verified: ${(err as Error).message}`,
    );
  }

  if (!verified.email) {
    throw new AppError(
      400,
      'INVALID_TOKEN',
      'Firebase token has no verified email — expected an email/password token',
    );
  }

  const identityHash = hashIdentifier(verified.email.trim().toLowerCase());

  let user = await prisma.user.findFirst({
    where: { role, phone_number_hash: identityHash },
  });

  if (!user) {
    user = await prisma.user.create({
      data: { role, phone_number_hash: identityHash },
    });
  }

  const token = signAccessToken(user.id, user.role);
  return { token, user };
}
