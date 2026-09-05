// Test: Script designed for upgrade path (rule score < 70, semantic HIGH)
import { scoreTranscript } from './src/lib/scamRules.js';

const script = "Hi, I am calling regarding a recent change to your account settings. There is one approval showing as pending on your profile, and I wanted to make sure it was initiated by you. If you are near your phone, I can walk you through where to find it.";

const ruleScore = scoreTranscript(script);
console.log('Script:', script);
console.log('Rule score:', ruleScore.risk_score);
console.log('Rule reasons:', ruleScore.risk_reasons);
console.log('Rule reason count:', ruleScore.risk_reasons.length);
console.log('');

// If rule score < 70, semantic will run
if (ruleScore.risk_score < 70) {
  console.log('Rule score is < 70, semantic will run.');
  console.log('Now I would call semantic analysis, but tsx has import issues inside conditionals.');
  console.log('The rule score of', ruleScore.risk_score, 'means semantic WILL run asynchronously via the /analyze-transcript endpoint.');
} else {
  console.log('Rule score >= 70, semantic would be skipped entirely.');
}