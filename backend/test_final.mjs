// Simplest live flow test: POST Script B to /analyze-transcript
import http from 'http';

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
  // Login first
  console.log('=== Login ===');
  let login = await fetch('/api/v1/auth/dev-login', JSON.stringify({ role: 'guardian', phone_number_hash: 'test-hash-123' }));
  let token = '';
  if (login.body && typeof login.body === 'object' && login.body.token) {
    token = login.body.token;
    console.log('Got token:', token.substring(0, 20) + '…');
  } else {
    console.log('Login body keys:', login.body ? Object.keys(login.body) : 'none');
  }

  // POST Script B
  console.log('\n=== POST Script B to /analyze-transcript ===');
  const transcript = 'Hi, I am calling regarding a recent change to your account settings. There is one approval showing as pending on your profile, and I wanted to make sure it was initiated by you. If you are near your phone, I can walk you through where to find it.';

  const result = await fetch('/api/v1/analyze-transcript', JSON.stringify({ transcript }), token);
  
  console.log('\n=== RESULT ===');
  console.log('status: ' + result.status);
  if (result.body && typeof result.body === 'object' && !result.body.error) {
    for (const key of ['risk_level', 'risk_score', 'upgraded', 'method', 'risk_reasons', 'concerning_phrases', 'reasoning']) {
      console.log(key + ': ' + (result.body[key] || 'N/A'));
    }
  } else {
    console.log('body: ' + (result.body || 'none'));
    if (result.body && result.body.error) {
      console.log('error: ' + result.body.error);
      console.log('code: ' + result.body.code);
    }
  }
}

main().catch(err => { console.error('Error:', err); process.exit(1); });