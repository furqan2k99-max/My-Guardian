import { scoreTranscript } from '../src/lib/scamRules';

describe('scamRules — new signals', () => {
  it('flags OTP-code-request scripts as high-risk', () => {
    const t =
      'Hello, this is the Security Verification Team. ' +
      'We detected unusual activity on your account and need to verify it immediately. ' +
      'To secure your account, please confirm the one-time verification code ' +
      'that was just sent to your phone.';

    const s = scoreTranscript(t);

    expect(s.risk_score).toBeGreaterThanOrEqual(60);
    expect(s.risk_reasons).toContain('otp_code_request');
    expect(s.risk_reasons).toContain('account_compromise');
    expect(s.risk_reasons).toContain('urgency_pressure');
  });

  it('flags calm account-pretexting scripts as suspicious', () => {
    const t =
      'Hi, I am calling regarding a recent change to your account settings. ' +
      'There is one approval showing as pending on your profile, and I wanted ' +
      'to make sure it was initiated by you. If you are near your phone, I can ' +
      'walk you through where to find it.';

    const s = scoreTranscript(t);

    // Must NOT be silent zero — at minimum the pretexting signal shows up.
    expect(s.risk_reasons).toContain('account_change_pretext');
    expect(s.risk_score).toBeGreaterThanOrEqual(25);
  });

  it('does not false-positive on a benign pharmacy reminder', () => {
    const t =
      'Hi, this is a reminder that your prescription is ready for pickup. ' +
      'You can call us if you have any questions. Have a great day.';

    const s = scoreTranscript(t);

    expect(s.risk_score).toBeLessThanOrEqual(20);
    expect(s.risk_reasons).not.toContain('payment_gift_card');
    expect(s.risk_reasons).not.toContain('family_emergency');
    expect(s.risk_reasons).not.toContain('otp_code_request');
    expect(s.risk_reasons).not.toContain('account_change_pretext');
  });

  it('multi-signal bonus kicks in when 3+ distinct categories match', () => {
    // Payment + authority + urgency + secrecy = classic IRS scam
    const t =
      'This is the IRS calling. You owe back taxes and have a warrant for your ' +
      'arrest. To avoid jail, send five hundred dollars in iTunes gift cards ' +
      'immediately. Do not tell anyone about this call.';

    const s = scoreTranscript(t);

    expect(s.risk_score).toBeGreaterThanOrEqual(100);
    expect(s.risk_reasons.length).toBeGreaterThanOrEqual(3);
    expect(s.risk_reasons).toContain('payment_gift_card');
    expect(s.risk_reasons).toContain('authority_impersonation');
  });
});
