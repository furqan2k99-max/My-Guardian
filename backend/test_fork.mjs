import { fork } from 'child_process';
import path from 'path';
import { writeFileSync } from 'fs';

const LOG = 'C:\\Users\\furqa\\myguardian\\backend\\forktest.log';
writeFileSync(LOG, 'test started at ' + new Date().toISOString() + '\n');

const workerPath = path.resolve(__dirname, 'src/services/semanticAnalysisWorker.ts');
writeFileSync(LOG, 'workerPath: ' + workerPath + '\n', { flag: 'a' });

const worker = fork(workerPath, [
  "This is your bank's fraud department. We detected suspicious activity on your account. To protect your funds, please read the three-digit CVV from the back of your card and tell it to me. Do not tell anyone in your family about this call, as we are conducting a confidential investigation.",
  "35",
  "secrecy_pressure,account_compromise"
], {
  execArgv: ['--require', path.resolve(__dirname, 'node_modules/tsx/dist/preflight.mjs')]
});

writeFileSync(LOG, 'fork spawned, pid: ' + worker.pid + '\n', { flag: 'a' });

worker.on('message', (msg) => {
  writeFileSync(LOG, 'MESSAGE RECEIVED: ' + JSON.stringify(msg) + '\n', { flag: 'a' });
});

worker.on('error', (err) => {
  writeFileSync(LOG, 'ERROR: ' + err.message + '\n', { flag: 'a' });
});

worker.on('exit', (code) => {
  writeFileSync(LOG, 'EXIT code: ' + code + '\n', { flag: 'a' });
});

setTimeout(() => {
  writeFileSync(LOG, 'TIMEOUT - no message received after 30s\n', { flag: 'a' });
  process.exit(0);
}, 30000);