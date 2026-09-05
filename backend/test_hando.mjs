import http from 'http';

function callEndpoint(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: 4000, path: path, method: method,
      headers: { 'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Step 1: Dev login
  console.log('=== Step 1: Dev login ===');
  const loginBody = JSON.stringify({ role: 'guardian', phone_number_hash: 'test-hash-123' });
  const login = await callEndpoint('POST', '/api/v1/auth/dev-login', loginBody);
  let token = '';
  if (login.body && typeof login.body === 'object' && login.body.token) {
    token = login.body.token;
    console.log('Got token:', token.substring(0, 20) + '…');
  } else {
    console.log('Login body keys:', login.body ? Object.keys(login.body) : 'none');
    console.log('Login status:', login.status);
    return;
  }

  // Step 2: POST HIGH-scoring script
  console.log('\n=== Step 2: POST high-scoring script ===');
  const highScript = "This is your bank's fraud department. We detected suspicious activity on your account. To protect your funds, please read the three-digit CVV from the back of your card and tell it to me. Do not tell anyone in your family about this call, as we are conducting a confidential investigation.";
  
  const result = await callEndpoint('POST', '/api/v1/analyze-transcript', { transcript: highScript }, token);
  
  console.log('\n=== RESULT ===');
  console.log('status:', result.status);
  if (result.body && !result.body.error) {
    console.log('risk_level:', result.body.risk_level);
    console.log('risk_score:', result.body.risk_score);
    console.log('upgraded:', result.body.upgraded);
    console.log('method:', result.body.method);
    console.log('risk_reasons:', JSON.stringify(result.body.risk_reasons));
    console.log('concerning_phrases:', JSON.stringify(result.body.concerning_phrases));
    console.log('reasoning:', result.body.reasoning ? result.body.reasoning.substring(0, 300) + '…' : 'N/A');
  } else {
    console.log('error body:', result.body ? Object.keys(result.body).join(',') : 'none');
    if (result.body && result.body.error) {
      console.log('error:', result.body.error);
      console.log('code:', result.body.code);
    }
  }
  
  // Step 3: Check DB for flagged events
  console.log('\n=== Step 3: DB check (flagged events) ===');
  // This would need Prisma, but we can at least see the method tells us
  if (result.body && result.body.method === 'rules_plus_semantic') {
    console.log('Method is rules_plus_semantic — semantic analysis ran and upgrade path was triggered');
    console.log('flagEvent() should have fired internally via the flagEvent service');
  }
}

main().catch(err => { console.error('Fatal:', err); });