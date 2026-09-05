const http = require('http');
const fs = require('fs');

const LOG = 'C:\\Users\\furqa\\myguardian\\backend\\forktest.log';
fs.writeFileSync(LOG, 'Testing ollama API...\n');

const body = JSON.stringify({
  model: 'llama3.1:latest',
  prompt: 'Say hello in one word',
  stream: false
});

const start = Date.now();
const req = http.request({
  hostname: 'localhost',
  port: 11434,
  path: '/api/generate',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const elapsed = Date.now() - start;
    fs.writeFileSync(LOG, 'API response in ' + elapsed + 'ms:\n' + data.substring(0, 500) + '\n', { flag: 'a' });
    process.exit(0);
  });
});

req.on('error', (err) => {
  fs.writeFileSync(LOG, 'API error: ' + err.message + '\n', { flag: 'a' });
  process.exit(1);
});

req.write(body);
req.end();

setTimeout(() => {
  fs.writeFileSync(LOG, 'TIMEOUT after 30s\n', { flag: 'a' });
  process.exit(1);
}, 30000);