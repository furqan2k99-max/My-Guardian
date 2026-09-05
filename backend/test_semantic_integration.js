// Quick integration test for the new /api/v1/detection/analyze-transcript endpoint
const http = require('http');

function makeRequest(path, body, callback) {
  const options = {
    hostname: 'localhost',
    port: 4000,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => callback(null, res.statusCode, data));
  });

  req.on('error', (e) => callback(e));
  req.write(JSON.stringify(body));
  req.end();
}

// Test Script B: calm pretexting - should be LOW/MEDIUM by rules, then upgraded by semantic
makeRequest('/api/v1/detection/analyze-transcript', {
  transcript: 'Hi, I am calling regarding a recent change to your account settings. There is one approval showing as pending on your profile, and I wanted to make sure it was initiated by you. If you are near your phone, I can walk you through where to find it.'
}, (err, statusCode, data) => {
  if (err) { console.error('ERROR:', err); process.exit(1); }
  console.log(`Script B - Status: ${statusCode}`);
  console.log('Response:', data);
  // Parse and check if upgraded
  try {
    const parsed = JSON.parse(data);
    console.log('  risk_level:', parsed.risk_level);
    console.log('  risk_score:', parsed.risk_score);
    console.log('  upgraded:', parsed.upgraded);
    console.log('  method:', parsed.method);
  } catch(e) {
    console.log('  (not JSON)');
  }
  console.log('');
});