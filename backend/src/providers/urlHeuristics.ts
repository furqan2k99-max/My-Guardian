import { logger } from '../lib/logger';

export interface ReputationVerdict {
  /**
   * 0..100 risk scale. `null` means "no verdict available"
   * (vendor not configured or vendor unreachable).
   */
  score: number | null;
  source: string;
}

/**
 * Local URL reputation heuristics. Runs before any external vendor so a
 * verdict is always returned for well-known domains and obvious scam
 * patterns, even when no Safe Browsing key is configured.
 *
 * Categories:
 *   - allowlist: explicit known-legitimate domain → score 5
 *   - denylist:  explicit known-bad domain        → score 95
 *   - heuristics: pattern-based (typosquats, IP, suspicious TLD, …)
 *
 * Anything that doesn't match a rule falls through to the optional external
 * vendor (Google Safe Browsing) in `safeBrowsing.ts`. If that vendor is also
 * not configured, we return a moderate "unknown but flag-when-elder-checks"
 * score so the elder app can decide whether to share the link with the
 * guardian based on the elder's explicit "check this" intent.
 */
export async function checkUrlHeuristics(rawUrl: string): Promise<ReputationVerdict> {
  const url = normalizeUrl(rawUrl);
  if (!url) {
    return { score: 80, source: 'heuristic_invalid_url' };
  }

  const host = url.hostname.toLowerCase();

  // 1. Allowlist — explicit known-legitimate domains.
  if (ALLOWLIST.has(host)) {
    return { score: 5, source: 'heuristic_allowlist' };
  }
  for (const suffix of ALLOWLIST_SUFFIXES) {
    if (host === suffix || host.endsWith('.' + suffix)) {
      return { score: 10, source: 'heuristic_allowlist_suffix' };
    }
  }

  // 2. Denylist — known phishing / scam patterns.
  if (DENYLIST.has(host)) {
    return { score: 95, source: 'heuristic_denylist' };
  }

  // 3. Heuristic rules — additive, capped at 95.
  const flags: { name: string; weight: number }[] = [];

  // Raw IP as host (no DNS name).
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    flags.push({ name: 'raw_ip_host', weight: 50 });
  }

  // Suspicious TLDs commonly used in phishing (curated, conservative).
  const tld = host.split('.').pop() ?? '';
  if (SUSPICIOUS_TLDS.has(tld)) {
    flags.push({ name: 'suspicious_tld', weight: 25 });
  }

  // Typosquat: digits replacing letters, or lookalike chars.
  if (/\d/.test(host.replace(/^\d+\./, '').split('.').slice(-2)[0] ?? '')) {
    flags.push({ name: 'digits_in_hostname', weight: 20 });
  }

  // Excessive subdomain depth (≥4 labels before the TLD) is unusual for legit sites.
  const labels = host.split('.');
  if (labels.length >= 5) {
    flags.push({ name: 'deep_subdomain', weight: 15 });
  }

  // Hyphens in the registrable domain are a mild phishing signal.
  if ((host.split('.').slice(-2, -1)[0] ?? '').includes('-')) {
    flags.push({ name: 'hyphen_in_domain', weight: 15 });
  }

  // Very long host (>50 chars) is unusual for legitimate sites.
  if (host.length > 50) {
    flags.push({ name: 'long_host', weight: 15 });
  }

  // Punycode / IDN homograph attack.
  if (host.includes('xn--')) {
    flags.push({ name: 'punycode', weight: 35 });
  }

  // URL shortener — masks the real destination.
  if (URL_SHORTENERS.has(host)) {
    flags.push({ name: 'url_shortener', weight: 30 });
  }

  // Free-hosting subdomain frequently used for phishing kits.
  if (FREE_HOSTING.has(host)) {
    flags.push({ name: 'free_hosting', weight: 20 });
  }

  // http:// (no TLS) for anything that looks like a login/bank page.
  if (url.protocol === 'http:') {
    flags.push({ name: 'no_tls', weight: 20 });
  }

  // Port other than 80/443 in URL is a red flag.
  if (url.port && url.port !== '80' && url.port !== '443') {
    flags.push({ name: 'nonstandard_port', weight: 25 });
  }

  // Look for "login", "verify", "secure" in the path — common phishing paths.
  const pathLower = url.pathname.toLowerCase();
  if (/\/(login|verify|secure|account|update|confirm)/.test(pathLower)) {
    flags.push({ name: 'phishing_path_keyword', weight: 15 });
  }

  if (flags.length > 0) {
    // Any single heuristic flag starts at 25; multiple flags accumulate
    // and cap at 95. Even a single mild flag (e.g. one hyphen, no TLS)
    // should not be silently treated as safe.
    const score = Math.min(95, flags.reduce((acc, f) => acc + f.weight, 15));
    logger.debug({ host, flags: flags.map(f => f.name), score }, 'url heuristic flags');
    return { score, source: 'heuristic_combined' };
  }

  // No flags, no allowlist match. Unfamiliar but unremarkable domain — the
  // user explicitly asked to share this with the elder app, so we treat the
  // "check this" gesture as a mild caution (the elder app will auto-share
  // the URL with the guardian above the 30-point threshold).
  return { score: 45, source: 'heuristic_unknown_domain' };
}

// ---------------------------------------------------------------------------
// Curated lists. Kept small and verifiable rather than a giant DB; the rule
// engine is meant to be a *signal*, not a black-box decision.
// ---------------------------------------------------------------------------

const ALLOWLIST = new Set<string>([
  // Empty by design: legitimate sites are covered by ALLOWLIST_SUFFIXES
  // (e.g. accounts.google.com matches ".google.com"). Only list a host
  // here if it is a single-label domain (rare; e.g. localhost).
]);

// Any subdomain of these is treated as safe.
const ALLOWLIST_SUFFIXES: string[] = [
  'google.com',
  'youtube.com',
  'gmail.com',
  'microsoft.com',
  'live.com',
  'outlook.com',
  'apple.com',
  'amazon.com',
  'amazon.in',
  'amazon.co.uk',
  'wikipedia.org',
  'github.com',
  'gitlab.com',
  'stackoverflow.com',
  'reddit.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'whatsapp.com',
  'paypal.com',
  'stripe.com',
  'razorpay.com',
  'phonepe.com',
  'pay.google.com',
  'mygov.in',
  'uidai.gov.in',
  'incometax.gov.in',
  'epfindia.gov.in',
  'india.gov.in',
  'irctc.co.in',
  'sbi.co.in',
  'onlinesbi.sbi',
  'hdfcbank.com',
  'icicibank.com',
  'axisbank.com',
  'kotak.com',
  'pnbindia.in',
  'bankofbaroda.in',
  'amazonaws.com',
  'cloudfront.net',
  'gov.in',
  'gov.uk',
  'gov.au',
  'gov.ca',
];

const DENYLIST = new Set<string>([
  // Common typosquats / active phishing kits. Conservative — add only if
  // verified malicious. Real-time blacklists belong in Safe Browsing.
  'paypa1.com',
  'paypa1-secure.com',
  'amaz0n-security.com',
  'apple-id-locked.com',
  'netflix-billing-update.com',
  'whatsapp-verify-now.com',
  'irs-gov-owed.tk',
  'fedex-delivery.ml',
  'dhl-redelivery.ga',
  'kyc-update-required.xyz',
]);

const SUSPICIOUS_TLDS = new Set<string>([
  'tk', 'ml', 'ga', 'cf', 'gq', // Freenom TLDs — heavy abuse.
  'xyz', 'top', 'click', 'country', 'kim', 'work', 'link', 'loan',
  'review', 'date', 'racing', 'win', 'science', 'stream', 'download',
  'bid', 'cricket', 'accountant', 'faith', 'party', 'trade', 'webcam',
]);

const URL_SHORTENERS = new Set<string>([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
  'rebrand.ly', 'cutt.ly', 'short.io', 'rb.gy', 'shorturl.at',
]);

const FREE_HOSTING = new Set<string>([
  // Subdomains of these are heavily abused for phishing pages.
  'weebly.com', 'wixsite.com', '000webhostapp.com', 'blogspot.com',
  'wordpress.com', 'googlepages.dev', 'appspot.com', 'firebaseapp.com',
  'netlify.app', 'vercel.app', 'render.com', 'glitch.me', 'repl.co',
  'pages.dev', 'gitbook.io', 'notion.site',
]);

function normalizeUrl(raw: string): URL | null {
  let input = raw.trim();
  if (!input) return null;
  if (!/^https?:\/\//i.test(input)) {
    input = 'http://' + input;
  }
  try {
    return new URL(input);
  } catch {
    return null;
  }
}
