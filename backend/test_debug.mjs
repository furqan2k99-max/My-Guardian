// Live flow test: Debug the raw response
import http from 'http';

function fetch(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: data }); }
        catch { resolve({ status: res.statusCode, headers: res.headers, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Login
  console.log('=== Login ===');
  const login = await fetch({
    hostname: 'localhost', port: 4000,
    path: '/api/v1/auth/dev-login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { role: 'guardian', phone_number_hash: 'test-hash-123' });
  
  console.log('Login response:', JSON.stringify(login, null, 2));
  
  let token = login.access_token || login.token || '';
  
  // Test analyze-transcript
  console.log('\n=== analyze-transcript ===');
  const transcript = 'Hi, I am calling regarding a recent change to your account settings. There is one approval showing as pending on your profile, and I wanted to make sure it was initiated by you. If you are near your phone, I can walk you through where to find it.';
  
  const result = await fetch({
    hostname: 'localhost', port: 4000,
    path: '/api/v1/analyze-transcript', method: 'POST',
    headers: { 'Content-Type': 'application/json', 
      ...(token ? { 'Authorization': 'Bearer ' + token } : {})
    }
  }, { transcript });
  
  console.log('Full result:', JSON.stringify(result, null, 2));
}

main();