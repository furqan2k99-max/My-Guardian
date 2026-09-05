const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

const LOG = 'C:\\Users\\furqa\\myguardian\\backend\\forktest.log';
fs.writeFileSync(LOG, '');

const workerPath = path.resolve(__dirname, 'dist/services/semanticAnalysisWorker.js');
fs.writeFileSync(LOG, 'workerPath: ' + workerPath + '\n', { flag: 'a' });
fs.writeFileSync(LOG, 'exists: ' + fs.existsSync(workerPath) + '\n', { flag: 'a' });

const worker = fork(workerPath, [
  "This is your bank's fraud department. We detected suspicious activity on your account. To protect your funds, please read the three-digit CVV from the back of your card and tell it to me. Do not tell anyone in your family about this call, as we are conducting a confidential investigation.",
  "35",
  "secrecy_pressure,account_compromise"
]);

fs.writeFileSync(LOG, 'fork spawned, pid: ' + worker.pid + '\n', { flag: 'a' });

worker.on('message', (msg) => {
  fs.writeFileSync(LOG, 'MESSAGE: ' + JSON.stringify(msg) + '\n', { flag: 'a' });
  process.exit(0);
});

worker.on('error', (err) => {
  fs.writeFileSync(LOG, 'ERROR: ' + err.message + '\n', { flag: 'a' });
  process.exit(1);
});

worker.on('exit', (code, signal) => {
  fs.writeFileSync(LOG, 'EXIT code=' + code + ' signal=' + signal + '\n', { flag: 'a' });
});

setTimeout(() => {
  fs.writeFileSync(LOG, 'TIMEOUT\n', { flag: 'a' });
  process.exit(0);
}, 60000);