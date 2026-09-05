const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

const LOG = 'C:\\Users\\furqa\\myguardian\\backend\\forktest.log';
fs.writeFileSync(LOG, 'test started at ' + new Date().toISOString() + '\n');

const workerPath = path.resolve(__dirname, 'src/services/semanticAnalysisWorker.ts');
fs.writeFileSync(LOG, 'workerPath: ' + workerPath + '\n', { flag: 'a' });
fs.writeFileSync(LOG, 'worker exists: ' + fs.existsSync(workerPath) + '\n', { flag: 'a' });
fs.writeFileSync(LOG, 'worker js exists: ' + fs.existsSync(path.resolve(__dirname, 'dist/services/semanticAnalysisWorker.js')) + '\n', { flag: 'a' });

const worker = fork(workerPath, [
  "This is your bank's fraud department. We detected suspicious activity on your account. To protect your funds, please read the three-digit CVV from the back of your card and tell it to me. Do not tell anyone in your family about this call, as we are conducting a confidential investigation.",
  "35",
  "secrecy_pressure,account_compromise"
], {
  execArgv: ['--require', path.resolve(__dirname, 'node_modules/tsx/dist/preflight.mjs')]
});

fs.writeFileSync(LOG, 'fork spawned, pid: ' + worker.pid + '\n', { flag: 'a' });

worker.on('message', (msg) => {
  fs.writeFileSync(LOG, 'MESSAGE RECEIVED: ' + JSON.stringify(msg) + '\n', { flag: 'a' });
});

worker.on('error', (err) => {
  fs.writeFileSync(LOG, 'ERROR: ' + err.message + '\n', { flag: 'a' });
});

worker.on('exit', (code) => {
  fs.writeFileSync(LOG, 'EXIT code: ' + code + '\n', { flag: 'a' });
});

setTimeout(() => {
  fs.writeFileSync(LOG, 'TIMEOUT - no message received after 45s\n', { flag: 'a' });
  process.exit(0);
}, 45000);