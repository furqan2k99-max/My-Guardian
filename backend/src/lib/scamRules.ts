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
  /**
   * Negative-signal rules that fired (e.g. "legitimate_transfer_details").
   * They reduce the score instead of adding to it. Surfaced for transparency
   * to the user; they are NOT reasons the call is suspicious.
   */
  supporting_reasons: string[];
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
    weight: 35,
    patterns: [
      /\bone[- ]time (code|password|pin)\b/,
      /\bverification code\b/,
      /\botp\b/,
      /\bcode (that was |was )?(just )?(sent|texted) to (your|the) phone\b/,
      /\bconfirm the code\b|\bread (me |back )?the code\b/,
      /\bsix[- ]digit code\b/,
      /\bthe code (we|i|that) (just )?sent\b/,
      /\bcode (on your phone|in (your |the )?text)\b/,
    ],
  },
  {
    // Asking for raw card data — CVV, full card number, PIN, expiration —
    // is the #1 bank-impostor pattern. No legitimate bank or merchant ever
    // asks the cardholder to READ these back over the phone. Very strong
    // signal on its own.
    //
    // NOTE: "account number" alone is intentionally NOT here — bank account
    // numbers (for receiving a wire/transfer) are a legitimate ask. The
    // disambiguator is whether it's "CARD number" / "credit card number"
    // vs. "account number / A/C number" (the latter is the ledger account
    // a transfer would land in, not the card on the front of your wallet).
    reason: 'card_data_request',
    weight: 45,
    patterns: [
      // CVV (allow punctuation/whitespace: C.V.V., CVV, cvv2).
      /\bc(\s*\.\s*)?v(\s*\.\s*)?v(\s*2)?\b/i,
      /\bcard\s*security\s*code\b/,
      /\bsecurity\s*code (on|at the back|from) (the |your )?card\b/,
      /\bthree[- ]digit (code|number)\b/,
      /\b(back|rear) of (the |your )?card\b/,
      /\bcard verification\b/,
      // CARD-number readback (not "account number").
      /\b(read|give|tell) (me |us )?(the |your )?(full )?(credit|debit|atm|bank|plastic)? ?card( number)?\b/,
      /\b(credit|debit|atm|bank) card( number)?\b/,
      // PIN readback.
      /\b(read|give|tell) (me |us )?(your )?pin\b/,
      /\b(card |debit |atm |credit )?pin (code|number)?\b/,
      // Expiration / CVV-on-front.
      /\bexpir(a|tion|y) (date|month|year|on the card)\b/,
      // Cardholder name readback (the name ON the card, not the account holder).
      /\bcardholder('?s)? name\b/,
      // "Read the front of your card" / "numbers on the front".
      /\bnumbers? on the (front|back) of (the |your )?card\b/,
      /\b(read|tell) (me |us )?what('?s)? on (the |your )?card\b/,
    ],
  },
  {
    // Legitimate receiving-money asks (bank account details for a transfer
    // TO the elder) are a NEGATIVE signal — they argue the caller is
    // routing a real payment and reduce the overall risk score.
    //
    // Weight is intentionally modest (-10) so a single strong scam
    // signal (CVV readback, OTP request, etc.) still dominates and
    // scores >= 30 (flagged as suspicious). For a pure payment script
    // this is enough to drop the score to 0 (clean).
    //
    // Domain knowledge: account number, IFSC, bank name, branch,
    // beneficiary name, and amount are the standard fields a payer
    // needs to wire money to an Indian bank account. Asking for them
    // in a routine payment context is exactly what a legitimate caller
    // does.
    reason: 'legitimate_transfer_details',
    weight: -10,
    patterns: [
      // Bank routing identifiers.
      /\bifsc(\s*code)?\b/,
      /\bswift(\s*code)?\b/,
      /\brouting (number|code)\b/,
      /\b(sort code|aba)\b/,
      // Account identifiers (not card identifiers).
      /\b(account|a\/c|beneficiary) (number|no|num)\b/,
      /\bbeneficiary name\b/,
      // "Transfer / deposit / payment" context.
      /\b(transfer|wire|deposit|remit)(ing)? (money|funds|payment|the amount)\b/,
      /\b(wire|transfer|remit) to (your|your|the) (account|bank)\b/,
      /\bsend (the |you )?(money|amount|payment|funds)\b/,
      // Indian-context bank names.
      /\b(sbi|hdfc|icici|axis|kotak|pnb|bank of baroda|canara|union bank|indian bank)\b/,
      // Branch.
      /\bbranch (name|code|location)?\b/,
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
      // Common bank / fraud-department framings.
      /\b(fraud|bank|security) (department|team|division|officer)\b/,
      /\bthis is (your|the) bank\b/,
      /\bcalling from (your|the) bank\b/,
    ],
  },
  {
    reason: 'secrecy_pressure',
    weight: 20,
    patterns: [
      /\bdo(n'| no)t tell (anyone|mom|dad|your (mom|dad|parents)|the police|your family)\b/,
      /\bkeep this between (us|you and me)\b/,
      /\bnot supposed to tell\b/,
      /\bthis call is confidential\b/,
      /\bdon'?t (mention|talk to|share)\b/,
      /\bconfidential investigation\b/,
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
      /\bto (protect|secure|verify) (your|the) (funds|account)\b/,
    ],
  },
  {
    reason: 'account_compromise',
    weight: 20,
    patterns: [
      /\baccount (is |has been )?(suspended|locked|frozen|compromised)\b/,
      /\bunusual (activity|transactions?)\b/,
      /\bverify your (account|identity|ssn)\b/,
      /\byour ssn\b|\bsocial security number has\b/,
      /\bunauthorized (transaction|login|access)\b/,
      /\bdetected unusual activity\b/,
      /\bwe detected .* on your account\b/,
      /\bsuspicious activity\b/,
      /\bunauthorized (purchase|charge|withdrawal)\b/,
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
  const supportingReasons: string[] = [];
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

    if (rule.weight < 0) {
      // Negative-weight rules are *supporting evidence* — they push the
      // score down but shouldn't be presented to the user as a "risk
      // reason" because the caller asked for something legitimate.
      supportingReasons.push(rule.reason);
      total += rule.weight;
      // Multi-hit bonus applies to legitimate fields too — a single
      // "account number" alone is a small signal, but mentioning the
      // account number + IFSC + amount + branch all in one call is a
      // strong "this is a real transfer" signal.
      if (hitsThisCategory >= ESCALATION_THRESHOLD) {
        total += ESCALATION_BONUS;
      }
      continue;
    }

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
    risk_score: Math.max(0, Math.min(100, Math.round(total))),
    risk_reasons: reasons,
    matches,
    supporting_reasons: supportingReasons,
  };
}
