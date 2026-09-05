// Standalone Whisper transcription worker (real ESM — loaded via child
// process so the ESM-only transformers library and any native ONNX failure
// stay isolated from the API process).
//
// Protocol: raw little-endian Float32 PCM (16 kHz mono) on stdin → single
// JSON line on stdout: { ok: true, text } | { ok: false, error }.
import { pipeline, env } from '@huggingface/transformers';
import path from 'node:path';

env.cacheDir = path.resolve(process.cwd(), '.model-cache');

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const bytes = new Uint8Array(Buffer.concat(chunks));
const samples = new Float32Array(bytes.buffer, 0, Math.floor(bytes.length / 4));

try {
  const asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
  const out = await asr(samples);
  process.stdout.write(JSON.stringify({ ok: true, text: out.text ?? '' }));
} catch (e) {
  process.stdout.write(JSON.stringify({ ok: false, error: e.message }));
}
process.exit(0);