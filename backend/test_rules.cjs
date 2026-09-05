const http = require('http');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const r = http.request({ hostname: 'localhost', port: 4000, path, method, headers }, (res) => {
      let buf = ''; res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: (() => { try { return JSON.parse(buf); } catch { return buf; } })() }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const g = await req('POST', '/api/v1/auth/dev-login', { role: 'guardian', phone_number_hash: 'rule-test-' + Date.now() });
  const token = g.body.token;

  const cases = [
    {
      label: 'CVV direct',
      transcript: 'Hi this is your bank fraud department. We need to verify your account. Please read me the three digit C.V.V. from the back of your card.',
    },
    {
      label: 'CVV short',
      transcript: 'Ma\'am, send me your cvv so I can confirm this is your card.',
    },
    {
      label: 'Full card readback',
      transcript: 'Sir, for verification please read me the full card number and the security code on the back.',
    },
    {
      label: 'PIN readback',
      transcript: 'Tell me your debit pin so I can unlock your account from our end.',
    },
    {
      label: 'OTP impersonation',
      transcript: 'We just sent a six digit code to your phone. Read it back to me so I can complete the verification.',
    },
    {
      label: 'Original CVV script',
      transcript: "This is your bank's fraud department. We detected suspicious activity on your account. To protect your funds, please read the three-digit CVV from the back of your card and tell it to me. Do not tell anyone in your family about this call, as we are conducting a confidential investigation.",
    },
    {
      label: 'Benign: doctor appt',
      transcript: 'Hello Mrs. Smith, this is Dr. Patel\'s office calling to remind you about your appointment tomorrow at 2pm. Please bring your insurance card.',
    },
  ];

  for (const c of cases) {
    const r = await req('POST', '/api/v1/analyze-transcript', { transcript: c.transcript, source: 'phone_call' }, token);
    const reasons = r.body.risk_reasons ?? [];
    console.log(`${c.label.padEnd(28)} score=${String(r.body.risk_score).padStart(3)} reasons=[${reasons.join(', ')}]`);
  }
})();
