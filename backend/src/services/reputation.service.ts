import { ReputationIdentifierType } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { hashIdentifier } from '../lib/hash';
import { checkUrlThreat, ReputationVerdict } from '../providers/safeBrowsing';
import { checkUrlHeuristics } from '../providers/urlHeuristics';

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

  // 1. Local heuristics first — works offline, gives a verdict for every URL.
  const local = await checkUrlHeuristics(url);

  // If the local heuristics are confident, accept them and skip the vendor.
  // "Confident" = an explicit allowlist/denylist match, OR any heuristic
  // flag fired, OR a clean allowlist suffix. The only case we don't trust
  // local alone is `heuristic_unknown_domain` — there we let the vendor
  // speak if it's configured.
  const localIsConfident =
    local.source === 'heuristic_allowlist' ||
    local.source === 'heuristic_allowlist_suffix' ||
    local.source === 'heuristic_denylist' ||
    local.source === 'heuristic_invalid_url' ||
    local.source === 'heuristic_combined';

  if (localIsConfident) {
    return await cacheAndReturn(identifier_hash, local);
  }

  // 2. Unknown-but-unremarkable domain — try the external vendor if any.
  const verdict = await checkUrlThreat(url);
  if (verdict.score !== null) {
    return await cacheAndReturn(identifier_hash, verdict);
  }

  // 3. No vendor configured AND no local flags — flag as suspicious
  // (unknown + the elder explicitly asked to check it).
  return await cacheAndReturn(identifier_hash, local);
}

async function cacheAndReturn(
  identifier_hash: string,
  verdict: ReputationVerdict,
): Promise<ScanResult> {
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
