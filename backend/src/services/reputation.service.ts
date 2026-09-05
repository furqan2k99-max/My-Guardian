import { ReputationIdentifierType } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { hashIdentifier } from '../lib/hash';
import { checkUrlThreat, ReputationVerdict } from '../providers/safeBrowsing';

export interface ScanResult {
  identifier_hash: string;
  identifier_type: ReputationIdentifierType;
  score: number | null;
  source: string;
  cached: boolean;
}

const TTL_MS = Number(env.REPUTATION_TTL_SECONDS) * 1000;

export function isFresh(cachedAt: Date, ttlMs: number = TTL_MS): boolean {
  return Date.now() - cachedAt.getTime() <= ttlMs;
}

export async function scanUrl(url: string): Promise<ScanResult> {
  const identifier_hash = hashIdentifier(url);
  const cached = await prisma.reputationCache.findUnique({
    where: { identifier_hash },
  });

  if (cached && isFresh(cached.cached_at, cached.ttl * 1000)) {
    return {
      identifier_hash,
      identifier_type: cached.identifier_type,
      score: cached.score,
      source: cached.source,
      cached: true,
    };
  }

  const verdict = await checkUrlThreat(url);
  const next: ScanResult = {
    identifier_hash,
    identifier_type: ReputationIdentifierType.url,
    score: verdict.score,
    source: verdict.source,
    cached: false,
  };

  await prisma.reputationCache.upsert({
    where: { identifier_hash },
    create: {
      identifier_hash,
      identifier_type: next.identifier_type,
      score: next.score,
      source: next.source,
      ttl: env.REPUTATION_TTL_SECONDS,
    },
    update: {
      score: next.score,
      source: next.source,
      cached_at: new Date(),
      ttl: env.REPUTATION_TTL_SECONDS,
    },
  });

  return next;
}

/** Number reputation is a Phase-2+ integration (e.g. Twilio Lookup). */
export async function scanNumber(number: string): Promise<ScanResult> {
  const identifier_hash = hashIdentifier(number);
  const verdict: ReputationVerdict = { score: null, source: 'not_implemented' };
  return {
    identifier_hash,
    identifier_type: ReputationIdentifierType.number,
    score: verdict.score,
    source: verdict.source,
    cached: false,
  };
}
