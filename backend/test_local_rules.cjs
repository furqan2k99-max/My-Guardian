const { scoreTranscript } = require('./src/lib/scamRules');

const cases = [
  {
    label: 'Routine payment (account + IFSC + branch + amount)',
    transcript: 'Good morning, this is Ramesh from Acme Logistics. I am calling to confirm the bank transfer for your pending payment of fifty thousand rupees. Could you please confirm your beneficiary name, your account number, the IFSC code of your SBI branch, and the branch name? I will then remit the amount to your account today.',
  },
  {
    label: 'CVV in payment context',
    transcript: 'I am calling to send you a refund of fifteen thousand rupees. Please give me your account number and IFSC. Also, for verification, I need to read the three digit CVV from the back of your card.',
  },
];

for (const c of cases) {
  const s = scoreTranscript(c.transcript);
  console.log(c.label);
  console.log('  score =', s.risk_score);
  console.log('  risk_reasons =', s.risk_reasons);
  console.log('  supporting_reasons =', s.supporting_reasons);
  console.log();
}
