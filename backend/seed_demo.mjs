// Seed 3 fresh flagged events for the polished dashboard demo.
import http from 'http';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SAMPLES = [
  {
    label: 'IRS scam',
    transcript:
      "This is the IRS calling about your back taxes. If you do not pay immediately via gift cards, a warrant will be issued for your arrest. Do not hang up and do not contact your family or lawyer.",
  },
  {
    label: 'Grandchild emergency',
    transcript:
      "Grandma, it's me. I'm in trouble — I was just arrested and I need you to wire me $5,000 right now. Please don't tell mom and dad, I don't want them to know. Send the money to this account immediately.",
  },
  {
    label: 'Bank phishing',
    transcript:
      "Hi, this is your bank's fraud department. We've detected suspicious activity. To verify your account, please read me the one-time code we just texted to your phone. Do not share this with anyone, this is highly confidential.",
  },
];

function postRequest(path, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: 4000, path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function devLogin(role, phoneHash) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ role, phone_number_hash: phoneHash });
    const req = http.request({
      hostname: 'localhost', port: 4000, path: '/api/v1/auth/dev-login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error(body)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  // Use a fresh elder + guardian pairing for these events.
  const elderLogin = await devLogin('elder', 'demo-elder-' + Date.now());
  const guardianLogin = await devLogin('guardian', 'demo-guardian-' + Date.now());
  const elderToken = elderLogin.token;
  const guardianToken = guardianLogin.token;

  // Pair them.
  await new Promise((resolve, reject) => {
    const data = JSON.stringify({});
    const req = http.request({
      hostname: 'localhost', port: 4000, path: '/api/v1/family-links/invites', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + guardianToken, 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', async () => {
        const { invite_code } = JSON.parse(body);
        const data2 = JSON.stringify({ invite_code });
        const req2 = http.request({
          hostname: 'localhost', port: 4000, path: '/api/v1/family-links/accept', method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + elderToken, 'Content-Length': Buffer.byteLength(data2) },
        }, (res2) => { res2.on('data', () => {}); res2.on('end', resolve); });
        req2.on('error', reject);
        req2.write(data2);
        req2.end();
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });

  for (const sample of SAMPLES) {
    const r = await postRequest('/api/v1/analyze-transcript', {
      transcript: sample.transcript,
      source: 'phone_call',
      elder_user_id: elderLogin.user.id,
    }, elderToken);
    console.log(`[${sample.label}] status=${r.status} risk=${r.body.risk_score ?? r.body.risk_tier ?? '?'}`);
  }

  await prisma.$disconnect();
})();
