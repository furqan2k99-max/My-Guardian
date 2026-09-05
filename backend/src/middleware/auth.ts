import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../db/prisma';
import { hashIdentifier } from '../lib/hash';
import { verifyAccessToken } from '../lib/tokens';
import { AppError } from './errorHandler';
import { verifyFirebaseIdToken } from '../providers/firebaseAuth';

/**
 * Authenticates a bearer token. Accepts either:
 *  - MyGuardian access JWTs issued by /auth/firebase-login (or dev-login), or
 *  - a Firebase ID token directly (email/password session), resolving the user
 *    by the server-side hash of its verified email.
 *
 * The Firebase path is the safety property that matters: protected routes can
 * be reached with a genuine Firebase-verified identity, never from an
 * unverified client-supplied value.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      next(new AppError(401, 'UNAUTHORIZED', 'Missing bearer token'));
      return;
    }

    const rawToken = header.slice('Bearer '.length);

    // 1) Try our own access JWT first.
    let jwtUser;
    try {
      const payload = verifyAccessToken(rawToken);
      jwtUser = await prisma.user.findUnique({ where: { id: payload.sub } });
    } catch {
      jwtUser = undefined;
    }
    if (jwtUser) {
      req.user = jwtUser;
      next();
      return;
    }

    // 2) Fall back to a Firebase ID token (email/password session today).
    let verified;
    try {
      verified = await verifyFirebaseIdToken(rawToken);
    } catch {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token');
    }
    if (!verified.email) {
      throw new AppError(401, 'INVALID_TOKEN', 'Token has no verified email');
    }
    const identityHash = hashIdentifier(verified.email.trim().toLowerCase());
    const user =
      (await prisma.user.findFirst({
        where: { role: 'guardian', phone_number_hash: identityHash },
      })) ??
      (await prisma.user.findFirst({
        where: { role: 'elder', phone_number_hash: identityHash },
      }));
    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'No user for this verified email');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError(403, 'FORBIDDEN', 'Insufficient role'));
      return;
    }
    next();
  };
}