// Test the core scoring functions directly using tsx
import { scoreTranscript } from './src/lib/scamRules.js';
import { analyzeTranscriptSemantic } from './src/lib/analyzeTranscriptSemantic.js';

const scripts = {
  A: 'Hello, this is the Security Verification Team. We detected unusual activity on your account and need to verify it immediately. To secure your account, please confirm the one-time verification code that was just sent to your phone.',
  B: 'Hi, I am calling regarding a recent change to your account settings. There is one approval showing as pending on your profile, and I wanted to make sure it was initiated by you. If you are near your phone, I can walk you through where to find it.',
  C: 'Hi, this is Dr. Smith\'s office calling to confirm your appointment for this Thursday at 2pm. Please let us know if you need to reschedule.',
  D: 'This is your bank calling. We detected suspicious activity on your account. To protect your funds, please read the three-digit CVV from the back of your card and tell it to me.',
};

async function runTests() {
  for (const [name, transcript] of Object.entries(scripts)) {
    console.log(`\n=== ${name} ===`);
    console.log(`Transcript: ${transcript.substring(0, 60)}...`);

    // Rule-based score
    const ruleScore = scoreTranscript(transcript);
    console.log(`Rule score: ${ruleScore.risk_score} (reasons: ${ruleScore.risk_reasons.join(', ')})`);

    // Semantic score (this will be slow - ~10s each)
    console.log('Calling semantic analysis...');
    const start = Date.now();
    const semScore = analyzeTranscriptSemantic(transcript);
    const elapsed = Date.now() - start;
    console.log(`Semantic score: ${semScore.risk_level} / ${semScore.risk_score}`);
    console.log(`  reasoning: ${semScore.reasoning.substring(0, 100)}...`);
    console.log(`  concerning_phrases: ${semScore.concerning_phrases.join(', ')}`);
    console.log(`  latency: ${elapsed}ms`);
  }
}

runTests().catch(err => { console.error('Test failed:', err); process.exit(1); });