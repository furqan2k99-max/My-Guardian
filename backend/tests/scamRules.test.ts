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

  it('flags explicit CVV readback requests as high-risk on their own', () => {
    const t =
      "Hi this is your bank fraud department. We need to verify your account. " +
      "Please read me the three digit C.V.V. from the back of your card.";
    const s = scoreTranscript(t);
    expect(s.risk_reasons).toContain('card_data_request');
    expect(s.risk_reasons).toContain('authority_impersonation');
    expect(s.risk_reasons).toContain('urgency_pressure');
    expect(s.risk_reasons).toContain('account_compromise');
    expect(s.risk_score).toBeGreaterThanOrEqual(75);
  });

  it('flags short "send me your cvv" requests (no other signals)', () => {
    const t = "Ma'am, send me your cvv so I can confirm this is your card.";
    const s = scoreTranscript(t);
    expect(s.risk_reasons).toContain('card_data_request');
    expect(s.risk_score).toBeGreaterThanOrEqual(45);
  });

  it('flags PIN readback requests', () => {
    const t = 'Tell me your debit pin so I can unlock your account from our end.';
    const s = scoreTranscript(t);
    expect(s.risk_reasons).toContain('card_data_request');
    expect(s.risk_score).toBeGreaterThanOrEqual(45);
  });

  it('flags full card-number readback requests', () => {
    const t =
      'Sir, for verification please read me the full card number and the ' +
      'security code on the back.';
    const s = scoreTranscript(t);
    expect(s.risk_reasons).toContain('card_data_request');
    expect(s.risk_score).toBeGreaterThanOrEqual(45);
  });

  it('does not false-positive on a routine doctor appointment reminder', () => {
    const t =
      "Hello Mrs. Smith, this is Dr. Patel's office calling to remind you " +
      'about your appointment tomorrow at 2pm. Please bring your insurance card.';
    const s = scoreTranscript(t);
    expect(s.risk_score).toBeLessThanOrEqual(20);
    expect(s.risk_reasons).not.toContain('card_data_request');
    expect(s.risk_reasons).not.toContain('otp_code_request');
  });

  it('does not flag a routine receiving-money request (account number, IFSC, etc.)', () => {
    // Caller wants to wire money TO the elder. This is the canonical
    // legitimate ask — beneficiary name, account number, IFSC, bank
    // name, branch, amount. The script should score 0 (or very near 0)
    // and the supporting_reasons should explain why.
    const t =
      'Good morning, this is Ramesh from Acme Logistics. I am calling to ' +
      'confirm the bank transfer for your pending payment of fifty thousand ' +
      'rupees. Could you please confirm your beneficiary name, your account ' +
      'number, the IFSC code of your SBI branch, and the branch name? I will ' +
      'then remit the amount to your account today.';
    const s = scoreTranscript(t);
    expect(s.risk_reasons).not.toContain('card_data_request');
    expect(s.risk_reasons).not.toContain('otp_code_request');
    expect(s.risk_reasons).not.toContain('account_compromise');
    expect(s.supporting_reasons).toContain('legitimate_transfer_details');
    // Should be very low — the only signal is authority impersonation
    // ("Ramesh from Acme Logistics"), if any.
    expect(s.risk_score).toBeLessThan(25);
  });

  it('still flags a CVV readback even in a payment context', () => {
    // The script says "I need to send you money" first (legitimate
    // framing) but then asks for the CVV. CVV + the legitimate framing
    // should still be high risk — the legitimate framing is exactly
    // the bank-impersonation trick the semantic layer warns about.
    const t =
      'I am calling to send you a refund of fifteen thousand rupees. Please ' +
      'give me your account number and IFSC. Also, for verification, I need ' +
      'to read the three digit CVV from the back of your card.';
    const s = scoreTranscript(t);
    expect(s.risk_reasons).toContain('card_data_request');
    // The legitimate-field signal lives in supporting_reasons (it
    // subtracts from the score, it is not itself a "risk reason").
    expect(s.supporting_reasons).toContain('legitimate_transfer_details');
    // CVV is 45; legitimate fields can subtract up to 40. Net should
    // still be ≥ 30, i.e. flagged as suspicious, not safe.
    expect(s.risk_score).toBeGreaterThanOrEqual(30);
  });
});
