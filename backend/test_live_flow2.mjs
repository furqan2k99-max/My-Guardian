// Live flow test: Script B through /analyze-transcript
// Captures initial HTTP response AND Node.js process output (logs)

import http from 'http';
import { spawn } from 'child_process';

async function main() {
  // Step 1: Login
  console.log('=== Step 1: Login ===');
  let loginBody = JSON.stringify({ role: 'guardian', phone_number_hash: 'test-hash-123' });
  
  let loginResult = '';
  await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 4000,
      path: '/api/v1/auth/dev-login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        loginResult = data;
        try { const p = JSON.parse(data); console.log('Login token:', p.token ? 'yes' : 'no'); }
        catch { console.log('Login body:', data.substring(0, 100)); }
        resolve();
      });
    });
    req.on('error', reject);
    req.write(loginBody);
    req.end();
  });

  let token = '';
  try { token = JSON.parse(loginResult).token || ''; }
  catch {}

  // Step 2: POST Script B to /analyze-transcript
  console.log('\n=== Step 2: POST Script B ===');
  const transcript = 'Hi, I am calling regarding a recent change to your account settings. There is one approval showing as pending on your profile, and I wanted to make sure it was initiated by you. If you are near your phone, I can walk you through where to find it.';

  let initialResult = '';
  await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 4000,
      path: '/api/v1/analyze-transcript', method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        initialResult = data;
        console.log('HTTP status: ' + res.statusCode);
        try { 
          const p = JSON.parse(data);
          console.log('risk_level: ' + p.risk_level);
          console.log('risk_score: ' + p.risk_score);
          console.log('upgraded: ' + p.upgraded);
          console.log('method: ' + p.method);
        } catch(e) { console.log('Not JSON: ' + data.substring(0, 200)); }
        resolve();
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ transcript }));
    req.end();
  });

  // Step 3: Wait for background worker to complete (Ollama ~10-15s)
  // Then check the Node.js process output for log messages
  console.log('\n=== Step 3: Waiting for semantic worker (20s max) ===');
  
  const worker = spawn(process.execPath, [require.resolve('./test_capture_logs.mjs')], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/myguardian_test?schema=public' }
  });

  // Wait for worker to finish
  await new Promise(resolve => worker.on('exit', resolve));
  console.log('Worker finished');

  // Step 4: Show results
  console.log('\n=== Step 4: Results ===');
  console.log('Initial HTTP response: ' + initialResult.substring(0, 200));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });