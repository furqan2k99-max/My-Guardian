import { analyzeTranscriptSemantic } from './src/lib/analyzeTranscriptSemantic';
const transcript = "This is your bank's fraud department. We detected suspicious activity on your account. To protect your funds, please read the three-digit CVV from the back of your card and tell it to me. Do not tell anyone in your family about this call, as we are conducting a confidential investigation.";
const result = analyzeTranscriptSemantic(transcript);
console.log(JSON.stringify(result, null, 2));