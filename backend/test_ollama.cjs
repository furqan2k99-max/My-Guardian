const { spawn } = require('child_process');
const fs = require('fs');

const LOG = 'C:\\Users\\furqa\\myguardian\\backend\\forktest.log';
fs.writeFileSync(LOG, '');

// Test: just run ollama directly and see if it works
const start = Date.now();
fs.writeFileSync(LOG, 'Starting ollama call...\n', { flag: 'a' });

const proc = spawn('ollama', ['run', 'llama3.1:latest', '--', 'say hello in one word'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let stdout = '';
let stderr = '';
proc.stdout.on('data', (data) => { stdout += data; });
proc.stderr.on('data', (data) => { stderr += data; });

proc.on('close', (code) => {
  const elapsed = Date.now() - start;
  fs.writeFileSync(LOG, 'Ollama completed in ' + elapsed + 'ms, code=' + code + '\n', { flag: 'a' });
  fs.writeFileSync(LOG, 'stdout: ' + stdout.substring(0, 200) + '\n', { flag: 'a' });
  fs.writeFileSync(LOG, 'stderr: ' + stderr.substring(0, 200) + '\n', { flag: 'a' });
  process.exit(0);
});

proc.on('error', (err) => {
  fs.writeFileSync(LOG, 'Error: ' + err.message + '\n', { flag: 'a' });
  process.exit(1);
});