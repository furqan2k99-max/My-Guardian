/**
 * Rule-based scam-pattern scoring over a call transcript — the audio
 * counterpart to the URL/reputation reasoning style used elsewhere in the
 * project: transparent keyword/pattern signals, no trained model, every
 * matched reason traceable to the text that triggered it.
 *
 * Weights are additive and capped at 100.  They are deliberately coarse for
 * the proof of concept; category ids double as `risk_reasons` values.
 */

export interface ScamRule {
  reason: string;
  weight: number;
  patterns: RegExp[];
}

export interface ScamMatch {
  reason: string;
  excerpt: string;
}

export interface ScamScore {
  risk_score: number;
  risk_reasons: string[];
  matches: ScamMatch[];
}

const EXCERPT_CONTEXT = 45;

function firstExcerpt(transcript: string, pattern: RegExp): string | null {
  const match = pattern.exec(transcript);
  if (!match) return null;
  const start = Math.max(0, match.index - EXCERPT_CONTEXT);
  const end = Math.min(transcript.length, match.index + match[0].length + EXCERPT_CONTEXT);
  let excerpt = transcript.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) excerpt = `…${excerpt}`;
  if (end < transcript.length) excerpt = `${excerpt}…`;
  return excerpt;
}

// ---------------------------------------------------------------------------
// Rules — each reason is a visible signal on the guardian's scorecard.
// ---------------------------------------------------------------------------
const SCAM_RULES: ScamRule[] = [
  {
    // Asking for a one-time code is near-always malicious: no legitimate
    // organization will ever need you to READ a code back to them.
    reason: 'otp_code_request',
    weight: 30,
    patterns: [
      /\bone[- ]time (code|password|pin)\b/,
      /\bverification code\b/,
      /\botp\b/,
      /\bcode (that was |was )?(just )?(sent|texted) to (your|the) phone\b/,
      /\bconfirm the code\b|\bread (me |back )?the code\b/,
      /\bsix[- ]digit code\b/,
    ],
  },
  {
    reason: 'payment_gift_card',
    weight: 35,
    patterns: [
      /\bgift cards?\b/,
      /\b(itunes|google play|steam) (card|codes?)\b/,
      /\bbitcoin\b|\bcryptocurrency\b|\bcrypto wallet\b/,
      /\bwire (transfer|the money|me the money)\b/,
      /\b(cash app|venmo|zelle|western union)\b/,
      /\bprepaid (card|debit)\b/,
    ],
  },
  {
    reason: 'family_emergency',
    weight: 30,
    patterns: [
      /\bit'?s (me|your) (grandson|granddaughter|grandson here)/,
      /\b(your )?grandson\b|\b(your )?granddaughter\b/,
      /\bi('m| am) in (jail|prison)\b/,
      /\bbail money\b/,
      /\bi('ve| have)? been in an? (accident|crash)\b/,
      /\bin a car accident\b/,
    ],
  },
  {
    reason: 'authority_impersonation',
    weight: 25,
    patterns: [
      /\binternal revenue service\b/,
      /\birs\b/,
      /\bsocial security (administration|office)\b/,
      /\bwarrant (out )?for (your|my) arrest\b/,
      /\barrest warrant\b/,
      /\bfederal (agent|officer)\b/,
      /\bofficer\b|\bdetective\b/,
      /\bcustoms (officer|department)\b/,
      /\bdrug (charges|cartel)\b/,
    ],
  },
  {
    reason: 'secrecy_pressure',
    weight: 20,
    patterns: [
      /\bdo(n'| no)t tell (anyone|mom|dad|your (mom|dad|parents)|the police)\b/,
      /\bkeep this between (us|you and me)\b/,
      /\bnot supposed to tell\b/,
      /\bthis call is confidential\b/,
    ],
  },
  {
    reason: 'urgency_pressure',
    weight: 15,
    patterns: [
      /\bimmediately\b/,
      /\bright (now|away)\b/,
      /\bwithin (the|an) hour\b/,
      /\blast warning\b/,
      /\bfinal notice\b/,
      /\bdo(n'| no)t hang up\b/,
      /\btoday only\b/,
      /\bact now\b/,
    ],
  },
  {
    reason: 'account_compromise',
    weight: 15,
    patterns: [
      /\baccount (is |has been )?(suspended|locked|frozen)\b/,
      /\bunusual (activity|transactions)\b/,
      /\bverify your (account|identity|ssn)\b/,
      /\byour ssn\b|\bsocial security number has\b/,
      /\bunauthorized (transaction|login|access)\b/,
      /\bdetected unusual activity\b/,
      /\bwe detected .* on your account\b/,
    ],
  },
  {
    reason: 'tech_support_scam',
    weight: 15,
    patterns: [
      /\byour computer (has|is)\b/,
      /\b(virus|malware|trojan)\b/,
      /\bhack(ed|er|ers)\b/,
      /\bmicrosoft (defender|security|technician)\b/,
      /\bgeek squad\b/,
      /\bremote (access|session) to your (computer|device)\b/,
    ],
  },
  {
    // Calm pretexting: modern scams skip pressure words entirely and instead
    // open a seemingly routine account topic, then guide the victim into
    // approving something. Weak alone, but stacks with other signals.
    reason: 'account_change_pretext',
    weight: 10,
    patterns: [
      /\b(recent|a) change to your account\b/,
      /\bchange(s)? to your (account|settings)\b/,
      /\bpending approval\b/,
      /\bapproval (showing as )?pending\b/,
      /\binitiated by you\b/,
      /\bwalk you through\b/,
      /\b(new )?(login|sign[- ]in|device) (attempt|detected)\b/,
    ],
  },
];

// ---------------------------------------------------------------------------
// Scoring engine
// ---------------------------------------------------------------------------

/** Multiple distinct phrases from ONE category = scripted social engineering. */
const ESCALATION_BONUS = 20;
const ESCALATION_THRESHOLD = 3;

/** Scams stack independent signals; genuine calls rarely trip even one. */
const MULTI_SIGNAL_BONUS_THRESHOLD = 3;
const MULTI_SIGNAL_BONUS = 20;

export function applyMultiSignalBonus(reasonCount: number, currentScore: number): number {
  if (reasonCount >= MULTI_SIGNAL_BONUS_THRESHOLD) {
    return Math.min(100, currentScore + MULTI_SIGNAL_BONUS);
  }
  return currentScore;
}

export function scoreTranscript(rawTranscript: string): ScamScore {
  const transcript = rawTranscript.toLowerCase().replace(/[\u2018\u2019]/g, "'");

  const reasons: string[] = [];
  const matches: ScamMatch[] = [];
  let total = 0;

  for (const rule of SCAM_RULES) {
    let hitsThisCategory = 0;
    let excerpt: string | null = null;

    for (const pattern of rule.patterns) {
      const hit = firstExcerpt(transcript, pattern);
      if (hit === null) continue;
      hitsThisCategory++;
      excerpt ??= hit;
    }

    if (!excerpt) continue;

    reasons.push(rule.reason);
    matches.push({ reason: rule.reason, excerpt });
    total += rule.weight;

    // Several DIFFERENT phrases from one category = scripted approach
    if (hitsThisCategory >= ESCALATION_THRESHOLD) {
      total += ESCALATION_BONUS;
    }
  }

  total = applyMultiSignalBonus(reasons.length, total);

  return {
    risk_score: Math.min(100, Math.round(total)),
    risk_reasons: reasons,
    matches,
  };
}
