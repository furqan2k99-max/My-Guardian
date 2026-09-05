import http from 'http';

interface SemanticScore {
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  risk_score: number;
  reasoning: string;
  concerning_phrases: string[];
  requested_info: string;
  legitimate_purpose: string;
  verdict: string;
}

/**
 * Calls Ollama's Llama 3.1 8B via HTTP API with a JSON-constrained prompt.
 * Uses /api/generate with stream=false for synchronous call.
 */
export function analyzeTranscriptSemantic(transcript: string): Promise<SemanticScore> {
  const normalized = transcript.toLowerCase().replace(/[\u2018\u2019]/g, "'");

  const systemPrompt = `You are a scam-detection analyst. Analyze the following phone call transcript and score its scam risk.

Output ONLY a valid JSON object matching this exact schema:
{
  "risk_level": "HIGH" or "MEDIUM" or "LOW",
  "risk_score": integer 0-100,
  "reasoning": "detailed explanation of why this is or isn't a scam",
  "concerning_phrases": ["specific phrases from the transcript that raise concern"],
  "requested_info": "what the caller is asking for, described literally",
  "legitimate_purpose": "what the caller claims their purpose is",
  "verdict": "one-sentence explanation"
}

Scoring rules:
- Requesting CVV, OTP, passwords, SSN, gift card codes, or bank details = HIGH (80-100)
- Creating urgency/panic + requesting sensitive info = HIGH (75-95)
- Pretending to be authority (bank, police, IRS) + requesting info = HIGH (70-90)
- Social isolation tactics ("don't tell your family") = HIGH (75-95)
- Combining authority pretense + secrecy + info request = HIGH (85-100)
- Legitimate appointment reminders, service calls with no info request = LOW (0-20)
- Mild social engineering without clear info request = MEDIUM (40-60)

Be aggressive in scoring. If the caller is asking for ANY sensitive information under false pretenses, that is HIGH.`;

  const userPrompt = `Transcript:\n${normalized}\n\nOutput ONLY the JSON object:`;

  const payload = JSON.stringify({
    model: 'llama3.1:latest',
    prompt: systemPrompt + '\n\n' + userPrompt,
    stream: false,
    options: {
      temperature: 0.1,
      num_predict: 500,
    }
  });

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const elapsed = Date.now() - startTime;
        (analyzeTranscriptSemantic as any).lastMs = elapsed;
        try {
          const ollamaResp = JSON.parse(data);
          const output = ollamaResp.response || '';
          let parsed: any;
          try {
            parsed = JSON.parse(output);
          } catch {
            const jsonMatch = output.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsed = JSON.parse(jsonMatch[0]);
            } else {
              reject(new Error('No JSON found in output: ' + output.substring(0, 200)));
              return;
            }
          }
          const result: SemanticScore = {
            risk_level: (parsed.risk_level || 'LOW').toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
            risk_score: Number(parsed.risk_score) || 0,
            reasoning: parsed.reasoning || 'No reasoning provided',
            concerning_phrases: Array.isArray(parsed.concerning_phrases) ? parsed.concerning_phrases : [],
            requested_info: parsed.requested_info || '',
            legitimate_purpose: parsed.legitimate_purpose || '',
            verdict: parsed.verdict || 'No verdict provided',
          };
          if (result.risk_score < 0) result.risk_score = 0;
          if (result.risk_score > 100) result.risk_score = 100;
          if (result.risk_level === 'LOW' && result.risk_score > 40) result.risk_level = 'MEDIUM';
          if (result.risk_level === 'LOW' && result.risk_score > 70) result.risk_level = 'HIGH';
          if (result.risk_level === 'HIGH' && result.risk_score < 60) result.risk_level = 'MEDIUM';
          if (result.risk_level === 'HIGH' && result.risk_score < 30) result.risk_level = 'LOW';
          resolve(result);
        } catch (e: any) {
          reject(e);
        }
      });
    });

    req.on('error', (err) => {
      const elapsed = Date.now() - startTime;
      (analyzeTranscriptSemantic as any).lastMs = elapsed;
      resolve({
        risk_level: 'LOW',
        risk_score: 0,
        reasoning: `Ollama call failed: ${err.message}`,
        concerning_phrases: [],
        requested_info: '',
        legitimate_purpose: '',
        verdict: 'Ollama unavailable — using rule engine instead',
      });
    });

    req.write(payload);
    req.end();
  }) as any;
}
