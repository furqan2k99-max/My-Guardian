import http from 'http';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ELDER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiZWxkZXIiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzg4Mjk2OTI2LCJleHAiOjE3ODgzODMzMjYsInN1YiI6ImNtdGo1dGZtZTAwMDE2MW5naTZpaHNwc28ifQ.qhCIqz0LBQg73T55rGMTTXobL42VIp52wq4MIk5MmiE';

const SCRIPT = "This is your bank's fraud department. We detected suspicious activity on your account. To protect your funds, please read the three-digit CVV from the back of your card and tell it to me. Do not tell anyone in your family about this call, as we are conducting a confidential investigation.";

function postRequest(path, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: 4000, path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== TEST: POST HIGH-scoring CVV script to /api/v1/analyze-transcript ===');
  console.log('Transcript:', SCRIPT);
  console.log('');

  // POST the script
  console.log('--- POST /api/v1/analyze-transcript ---');
  const start = Date.now();
  const response = await postRequest('/api/v1/analyze-transcript', { transcript: SCRIPT }, ELDER_TOKEN);
  const elapsed = Date.now() - start;
  console.log('HTTP status:', response.status);
  console.log('Response time:', elapsed + 'ms');
  console.log('Response body:', JSON.stringify(response.body, null, 2));

  // Wait for async worker to complete (~8-15s) + some buffer
  console.log('\n=== Waiting 20 seconds for async semantic worker + poll cycle ===');
  await new Promise(r => setTimeout(r, 20000));

  // Check DB for flagged events
  console.log('\n=== Checking DB for flagged events ===');
  const events = await prisma.flaggedEvent.findMany({
    orderBy: { created_at: 'desc' },
    take: 5,
    include: { elder_user: true }
  });
  console.log('Flagged events in DB:', events.length);
  events.forEach((e, i) => {
    console.log(`\nEvent ${i + 1}:`);
    console.log('  id:', e.id);
    console.log('  event_type:', e.event_type);
    console.log('  sender_hash:', e.sender_hash);
    console.log('  risk_score:', e.risk_score);
    console.log('  risk_reasons:', e.risk_reasons);
    console.log('  guardian_notified_at:', e.guardian_notified_at);
    console.log('  elder_action:', e.elder_action);
    console.log('  created_at:', e.created_at);
  });

  // Also check device_tokens
  const tokens = await prisma.deviceToken.findMany({ take: 10 });
  console.log('\nDevice tokens in DB:', tokens.length);
  tokens.forEach(t => console.log('  ', t.token, 'platform:', t.platform, 'user:', t.userId));

  await prisma.$disconnect();
  console.log('\n=== TEST COMPLETE ===');
}

main().catch(e => { console.error('Error:', e); process.exit(1); });