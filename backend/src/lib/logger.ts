import { randomUUID } from 'node:crypto';
import { pino } from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'myguardian-backend' },
  redact: {
    paths: ['req.headers.authorization', '*.headers.authorization'],
    censor: '[REDACTED]',
  },
});

export function newRequestId(): string {
  return randomUUID();
}
