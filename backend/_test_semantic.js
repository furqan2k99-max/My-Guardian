import { analyzeTranscriptSemantic } from './src/lib/analyzeTranscriptSemantic.js';

const A = 'Hello, this is the Security Verification Team. We detected unusual activity on your account and need to verify it immediately. To secure your account, please confirm the one-time verification code that was just sent to your phone.';
const B = 'Hi, I am calling regarding a recent change to your account settings. There is one approval showing as pending on your profile, and I wanted to make sure it was initiated by you. If you are near your phone, I can walk you through where to find it.';
const C = "Hi, this is Dr. Smith's office calling to confirm your appointment for this Thursday at 2pm. Please let us know if you need to reschedule.";
const D = 'This is your bank calling. We detected suspicious activity on your account. To protect your funds, please read the three-digit CVV from the back of your card and tell it to me.';

console.log('=== SCRIPT A (OTP scam) ===');
console.log(JSON.stringify(analyzeTranscriptSemantic(A), null, 2));
console.log('');
console.log('=== SCRIPT B (calm pretexting) ===');
console.log(JSON.stringify(analyzeTranscriptSemantic(B), null, 2));
console.log('');
console.log('=== SCRIPT C (doctor appointment) ===');
console.log(JSON.stringify(analyzeTranscriptSemantic(C), null, 2));
console.log('');
console.log('=== SCRIPT D (bank CVV scam) ===');
console.log(JSON.stringify(analyzeTranscriptSemantic(D), null, 2));