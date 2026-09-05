import { scoreTranscript } from './src/lib/scamRules.js';

const script = "This is your bank's fraud department. We detected suspicious activity on your account. To protect your funds, please read the three-digit CVV from the back of your card and tell it to me. Do not tell anyone in your family about this call, as we are conducting a confidential investigation.";

const r = scoreTranscript(script);
console.log('Script:', script.substring(0, 80) + '...');
console.log('Rule score:', r.risk_score);
console.log('Rule reasons:', r.risk_reasons);