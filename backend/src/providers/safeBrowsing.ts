import { env } from '../config/env';
import { logger } from '../lib/logger';

export interface ReputationVerdict {
  /**
   * 0..100 risk scale. `null` means "no verdict available"
   * (vendor not configured or vendor unreachable).
   */
  score: number | null;
  source: string;
}

const API_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

const THREAT_TYPES = [
  'MALWARE',
  'SOCIAL_ENGINEERING',
  'UNWANTED_SOFTWARE',
  'POTENTIALLY_HARMFUL_APPLICATION',
];

/**
 * Google Safe Browsing lookup. Returns a degraded "unknown" verdict when no
 * API key is configured or the vendor is unreachable, so scanning never
 * fails closed on infrastructure issues.
 */
export async function checkUrlThreat(url: string): Promise<ReputationVerdict> {
  if (!env.SAFE_BROWSING_API_KEY) {
    return { score: null, source: 'no_vendor_configured' };
  }

  try {
    const res = await fetch(`${API_URL}?key=${env.SAFE_BROWSING_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: { clientId: 'myguardian-backend', clientVersion: '0.1.0' },
        threatInfo: {
          threatTypes: THREAT_TYPES,
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }],
        },
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, 'safe browsing returned an error status');
      return { score: null, source: 'safe_browsing_error' };
    }

    const body = (await res.json()) as { matches?: unknown[] };
    return body.matches && body.matches.length > 0
      ? { score: 100, source: 'safe_browsing' }
      : { score: 0, source: 'safe_browsing' };
  } catch (err) {
    logger.warn({ err }, 'safe browsing lookup failed');
    return { score: null, source: 'safe_browsing_error' };
  }
}
