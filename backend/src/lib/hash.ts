import { createHash } from 'node:crypto';

/** Deterministic SHA-256 — never store/send raw identifiers (PLAN.md §3). */
export function hashIdentifier(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
