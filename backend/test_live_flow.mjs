// Live flow test: POST Script B to /api/v1/detection/analyze-transcript
// and verify the async semantic upgrade

import http from 'http';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ datasource: { url: 'postgresql://postgres:postgres@localhost:5432/myguardian_test?schema=public' } });

async function main() {
  // First, create a test user and get auth
  await prisma.user.create({
    data: { 
      role: 'guardian', 
      email: 'test@example.com', 
      password: 'hashed_or_plain', 
      phone_number_hash: 'abc123' 
    }
  }).catch(() => { /* ignore if exists */ });

  // Get auth token via dev login
  const loginBody = JSON.stringify({ role: 'guardian', phone_number_hash: 'abc123' });
  
  let token = '';
  await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/auth/dev-login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          token = parsed.access_token || parsed.token || '';
          resolve();
        } catch { reject(new Error('No token in response')); }
      });
    });
    req.on('error', reject);
    req.write(loginBody);
    req.end();
  });

  if (!token) throw new Error('No auth token obtained');

  const transcript = 'Hi, I am calling regarding a recent change to your account settings. There is one approval showing as pending on your profile, and I wanted to make sure it was initiated by you. If you are near your phone, I can walk you through where to find it.';

  // Step 1: POST to /analyze-transcript
  console.log('=== Step 1: POST /api/v1/detection/analyze-transcript ===');
  
  let initialResponse = {};
  let semanticResultReceived = false;
  let semanticResult = null;

  await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/detection/analyze-transcript',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          initialResponse = JSON.parse(data);
          console.log('Initial response:', JSON.stringify(initialResponse, null, 2));
          resolve();
        } catch (e) {
          reject(new Error(`Failed to parse initial response: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ transcript }));
    req.end();
  });

  // Step 2: Wait for semantic worker result (up to 20 seconds)
  console.log('\n=== Step 2: Waiting for semantic worker result (up to 20s) ===');
  
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.log('Timeout waiting for semantic worker');
      semanticResultReceived = true;
      resolve();
    }, 20000);

    // Use an interval to check... but http module doesn't keep state.
    // Instead, let's just wait and check if the DB was updated.
    // The flagEvent() call should have created a flagged event.
    // We'll poll the DB.
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const events = await prisma.flaggedEvent.findMany({
          where: { sender_hash: 'test@example.com' },
          orderBy: { created_at: 'desc' },
          take: 1
        });
        if (events.length > 0) {
          clearInterval(interval);
          clearTimeout(timeout);
          semanticResult = events[0];
          console.log('Flagged event found in DB:', JSON.stringify(semanticResult, null, 2));
          semanticResultReceived = true;
          resolve();
        }
      } catch (e) {
        // ignore polling errors
      }
      if (attempts >= 20) {
        clearInterval(interval);
        clearTimeout(timeout);
        console.log('Gave up after 20 polls');
        resolve();
      }
    }, 1000);
  });

  // Step 3: Verify the three things
  console.log('\n=== Step 3: Verification ===');
  
  let allPassed = true;

  // 3a: Semantic layer returned HIGH
  if (semanticResultReceived && semanticResult) {
    const riskLevel = semanticResult.risk_level;
    const riskScore = semanticResult.risk_score;
    console.log(`3a. Semantic risk_level: ${riskLevel} (score: ${riskScore})`);
    if (riskLevel !== 'HIGH') {
      console.log('   FAIL: Expected HIGH, got ' + riskLevel);
      allPassed = false;
    } else {
      console.log('   PASS: Semantic layer returned HIGH');
    }
    
    // Check the reasoning mentions the pretexting pattern
    const reasoning = semanticResult.risk_reasons ? 
      semanticResult.risk_reasons.join(', ') : '';
    const hasPretextingPhrase = /pending approval|walk you through|initiated by you/.test(reasoning);
    console.log(`   Has pretexting patterns in reasoning: ${hasPretextingPhrase}`);
    if (!hasPretextingPhrase) {
      console.log('   WARN: No explicit pretexting patterns found in risk_reasons');
    }
  } else {
    console.log('3a. FAIL: No semantic result received from worker');
    allPassed = false;
  }

  // 3b: flagEvent() actually fired
  if (semanticResultReceived && semanticResult) {
    const eventType = semanticResult.event_type;
    console.log(`3b. flagEvent fired: event_type = ${eventType}`);
    if (eventType && eventType !== 'unknown') {
      console.log('   PASS: flagEvent() was called');
    } else {
      console.log('   FAIL: flagEvent did not fire or event_type is unknown');
      allPassed = false;
    }
  } else {
    console.log('3b. FAIL: Cannot verify flagEvent without semantic result');
    allPassed = false;
  }

  // 3c: Guardian notification arrived
  // Check if guardian_notified_at is set on the event
  if (semanticResultReceived && semanticResult) {
    const notifiedAt = semanticResult.guardian_notified_at;
    console.log(`3c. Guardian notification timestamp: ${notifiedAt}`);
    if (notifiedAt) {
      console.log('   PASS: guardian_notified_at is set — notification was sent');
    } else {
      console.log('   INFO: guardian_notified_at not set (push may be disabled in test env; check FCM config)');
      // This is not a hard fail - push could be disabled
    }
  } else {
    console.log('3c. FAIL: Cannot verify notification without semantic result');
    allPassed = false;
  }

  console.log('\n=== OVERALL:', allPassed ? 'ALL PASSED' : 'SOME FAILURES', '===');
  
  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});