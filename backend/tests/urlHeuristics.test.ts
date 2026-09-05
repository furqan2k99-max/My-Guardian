import { checkUrlHeuristics } from '../src/providers/urlHeuristics';

describe('checkUrlHeuristics', () => {
  it('flags denylisted domains as dangerous', async () => {
    const v = await checkUrlHeuristics('https://paypa1-secure.com/login');
    expect(v.score).not.toBeNull();
    expect(v.score!).toBeGreaterThanOrEqual(70);
    expect(v.source).toBe('heuristic_denylist');
  });

  it('marks allowlisted exact domains as safe', async () => {
    const v = await checkUrlHeuristics('https://google.com');
    expect(v.score).toBe(10);
    expect(v.source).toBe('heuristic_allowlist_suffix');
  });

  it('marks allowlist-suffix subdomains as safe', async () => {
    const v = await checkUrlHeuristics('https://accounts.google.com/signin');
    expect(v.score).toBe(10);
    expect(v.source).toBe('heuristic_allowlist_suffix');
  });

  it('treats government subdomains as safe', async () => {
    const v = await checkUrlHeuristics('https://something.gov.in/portal');
    expect(v.score).toBe(10);
    expect(v.source).toBe('heuristic_allowlist_suffix');
  });

  it('flags suspicious TLDs (e.g. .tk)', async () => {
    const v = await checkUrlHeuristics('https://paypal-verify.tk/login');
    expect(v.score).not.toBeNull();
    expect(v.score!).toBeGreaterThanOrEqual(25);
  });

  it('flags raw-IP hosts', async () => {
    const v = await checkUrlHeuristics('http://192.168.1.50/login');
    expect(v.score).not.toBeNull();
    expect(v.score!).toBeGreaterThanOrEqual(50);
  });

  it('flags punycode/IDN homograph hosts', async () => {
    const v = await checkUrlHeuristics('https://xn--ggle-55da.com/login');
    expect(v.score).not.toBeNull();
    expect(v.score!).toBeGreaterThanOrEqual(35);
  });

  it('flags URL shorteners', async () => {
    const v = await checkUrlHeuristics('https://bit.ly/3xYza9Z');
    expect(v.score).not.toBeNull();
    expect(v.score!).toBeGreaterThanOrEqual(30);
  });

  it('flags phishing-path keywords', async () => {
    const v = await checkUrlHeuristics('https://unknown-site.com/login/verify-account');
    expect(v.score).not.toBeNull();
    expect(v.score!).toBeGreaterThanOrEqual(15);
  });

  it('returns a moderate score for unknown unremarkable domains', async () => {
    const v = await checkUrlHeuristics('https://example-restaurant-menu.com/menu');
    // hyphen_in_domain fires → score 30 (15 base + 15 weight)
    expect(v.score).not.toBeNull();
    expect(v.score!).toBeGreaterThanOrEqual(30);
    expect(v.source).toBe('heuristic_combined');
  });

  it('returns a moderate score for an utterly unknown unflagged domain', async () => {
    // No hyphens, no digits, no suspicious TLD — should fall through to
    // "unknown but you asked, so we flagged it" mode.
    const v = await checkUrlHeuristics('https://example.com/some-page');
    expect(v.score).toBe(45);
    expect(v.source).toBe('heuristic_unknown_domain');
  });

  it('rejects empty / malformed input', async () => {
    const v = await checkUrlHeuristics('');
    expect(v.score).not.toBeNull();
    expect(v.score!).toBeGreaterThanOrEqual(70);
  });

  it('auto-prefixes http when scheme is missing', async () => {
    const v = await checkUrlHeuristics('google.com');
    expect(v.source).toBe('heuristic_allowlist_suffix');
    expect(v.score).toBe(10);
  });
});
