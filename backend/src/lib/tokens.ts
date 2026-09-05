import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

interface AccessClaims {
  role: 'elder' | 'guardian';
  type: 'access';
}

export type AccessTokenPayload = AccessClaims & Pick<JwtPayload, 'sub'>;

export function signAccessToken(userId: string, role: 'elder' | 'guardian'): string {
  const payload: AccessClaims = { role, type: 'access' };
  return jwt.sign(payload, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    if (payload.type !== 'access' || !payload.sub) {
      throw new Error('Unexpected token type');
    }
    return payload;
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired access token');
  }
}
