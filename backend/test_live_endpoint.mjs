// Live endpoint test: POST Script B to /analyze-transcript
import http from 'http';
import { spawn } from 'child_process';

function fetch(path, body, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 4000,
      path: path, method: 'POST',
      headers: { 'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); }
        catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Step 1: Login
  console.log('=== Step 1: Login ===');
  let loginBody = JSON.stringify({ role: 'guardian', phone_number_hash: 'test-hash-123' });
  
  let loginResult = await fetch('/api/v1/auth/dev-login', loginBody);
  let token = '';
  if (loginResult.body && typeof loginResult.body === 'object' && loginResult.body.token) {
    token = loginResult.body.token;
    console.log('Got token:', token.substring(0, 20) + '…');
  } else {
    console.log('Login failed body:', loginResult.body ? Object.keys(loginResult.body).join(',') : 'none');
    // Without token, we'll try unauthenticated (some routes may work)
    token = '';
  }

  // Step 2: POST Script B
  console.log('\n=== Step 2: POST Script B to /analyze-transcript ===');
  const transcript = 'Hi, I am calling regarding a recent change to your account settings. There is one approval showing as pending on your profile, and I wanted to make sure it was initiated by you. If you are near your phone, I can walk you through where to find it.';

  let initialResult = await fetch('/api/v1/analyze-transcript', JSON.stringify({ transcript }), token);
  
  console.log('\n=== Initial HTTP Response ===');
  console.log('status: ' + initialResult.status);
  if (initialResult.body && typeof initialResult.body === 'object' && !initialResult.body.error) {
    console.log('risk_level: ' + initialResult.body.risk_level);
    console.log('risk_score: ' + initialResult.body.risk_score);
    console.log('upgraded: ' + initialResult.body.upgraded);
    console.log('method: ' + initialResult.body.method);
    console.log('risk_reasons: ' + JSON.stringify(initialResult.body.risk_reasons));
    console.log('concerning_phrases: ' + JSON.stringify(initialResult.body.concerning_phrases));
    console.log('reasoning: ' + (initialResult.body.reasoning ? initialResult.body.reasoning.substring(0, 200) + '…' : 'N/A'));
  } else {
    console.log('error: ' + (initialResult.body ? initialResult.body.error : 'none'));
    console.log('code: ' + (initialResult.body ? initialResult.body.code : 'none'));
  }

  // Step 3: Spawn a background process that waits for the semantic worker
  // and then checks the DB for the flagged event
  console.log('\n=== Step 3: Waiting for async semantic worker ===');
  const worker = spawn(process.execPath, [require.resolve('./test_worker.mjs')], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/myguardian_test?schema=postgres' }
  });

  // Print worker output to console
  worker.stdout.on('data', (data) => {
    console.log('WORKER OUTPUT: ' + data.toString());
  });
  worker.stderr.on('data', (data) => {
    console.log('WORKER ERROR: ' + data.toString());
  });

  // Wait for worker to finish
  await new Promise((resolve, reject) => {
    worker.on('exit', (code) => {
      console.log('Worker exited with code: ' + code);
      resolve();
    });
    worker.on('error', reject);
    // Wait up to 30 seconds
    setTimeout(() => {
      console.log('Timeout waiting for worker');
      resolve();
    }, 30000);
  });

  console.log('\n=== LIVE ENDPOINT TEST COMPLETE ===');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });