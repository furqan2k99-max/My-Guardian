import { analyzeTranscriptSemantic } from '../lib/analyzeTranscriptSemantic';

interface WorkerInput {
  transcript: string;
  ruleScore: number;
  ruleReasons: string;
}

interface WorkerOutput {
  type: 'semantic_result';
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  risk_score: number;
  reasoning: string;
  concerning_phrases: string[];
  risk_reasons: string[];
  verdict: string;
}

// Parse the three args passed from the parent process
const [transcript, ruleScoreStr, ruleReasonsStr] = process.argv.slice(2);
const ruleScore = Number(ruleScoreStr);
const ruleReasons = ruleReasonsStr ? ruleReasonsStr.split(',') : [];

async function run() {
  try {
    const semanticResult = await analyzeTranscriptSemantic(transcript);

    // Decide whether to upgrade: if rules said LOW/MEDIUM and semantic says HIGH, upgrade
    let upgraded = false;
    let finalRiskLevel = semanticResult.risk_level;
    let finalRiskScore = semanticResult.risk_score;
    let finalRiskReasons: string[] = semanticResult.concerning_phrases || [];
    let finalReasoning = semanticResult.reasoning;

    if (ruleScore < 70 && semanticResult.risk_level === 'HIGH') {
      upgraded = true;
      finalRiskLevel = 'HIGH';
      finalRiskScore = Math.min(100, ruleScore + 30);
      // Combine rule and semantic reasons
      finalRiskReasons = [...ruleReasons, ...(semanticResult.concerning_phrases || [])];
      finalReasoning = `Upgraded from rule-based score ${ruleScore} to HIGH by semantic analysis. ${semanticResult.reasoning}`;
    }

    const output: WorkerOutput = {
      type: 'semantic_result',
      risk_level: finalRiskLevel,
      risk_score: finalRiskScore,
      reasoning: finalReasoning,
      concerning_phrases: semanticResult.concerning_phrases || [],
      risk_reasons: finalRiskReasons,
      verdict: semanticResult.verdict,
    };

    // Send result back to parent and exit
    process.send!(output);
  } catch (e: any) {
    console.error('Semantic worker error:', e.message);
    // Send error result back
    const output: WorkerOutput = {
      type: 'semantic_result',
      risk_level: 'LOW',
      risk_score: 0,
      reasoning: `Semantic analysis failed: ${e.message || 'Unknown error'}`,
      concerning_phrases: [],
      risk_reasons: [],
      verdict: 'Analysis failed — rule-based result stands',
    };
    process.send!(output);
  } finally {
    process.exit(0);
  }
}

run();