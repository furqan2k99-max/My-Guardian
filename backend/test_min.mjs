import http from 'http';

function callEndpoint(path, path2, token) {
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
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ transcript: 'Hi, I am calling regarding a recent change to your account settings. There is one approval showing as pending on your profile, and I wanted to make sure it was initiated by you. If you are near your phone, I can walk you through where to find it.' }));
    req.end();
  });
}

async function main() {
  // Simple login
  const loginBody = JSON.stringify({ role: 'guardian', phone_number_hash: 'test-hash-123' });
  const login = await callEndpoint('/api/v1/auth/dev-login', '', '');
  let token = '';
  if (login.body && typeof login.body === 'object' && login.body.token) {
    token = login.body.token;
    console.log('Got token');
  }

  const result = await callEndpoint('/api/v1/analyze-transcript', '', token);
  console.log('Status:', result.status);
  if (result.body && !result.body.error) {
    console.log('risk_level:', result.body.risk_level);
    console.log('risk_score:', result.body.risk_score);
    console.log('upgraded:', result.body.upgraded);
    console.log('method:', result.body.method);
  } else {
    console.log('Error body:', result.body ? Object.keys(result.body) : 'none');
  }
}

main();