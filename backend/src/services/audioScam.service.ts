import { spawn } from 'node:child_process';
import path from 'node:path';
import { AudioDecodeError, decodeViaFfmpeg, decodeWavTo16kMono, needsFfmpeg } from '../lib/audioDecode';
import { scoreTranscript } from '../lib/scamRules';

/**
 * Audio-file scam analysis (proof of concept).
 *
 * Pipeline: uploaded bytes → 16 kHz mono PCM → local Whisper transcription →
 * rule-based scam-pattern scoring. Nothing about the audio is persisted: WAV
 * uploads are decoded straight from memory; mp3/m4a go through a private temp
 * directory that is deleted within the request lifecycle.
 *
 * STT engine: Whisper tiny.en via transformers.js / ONNX Runtime. Chosen over
 * cloud STT because it is free per-request, needs no API key, and keeps raw
 * call content on the server we already control — matching this project's
 * "raw content never leaves/never retained" posture. Tradeoffs: lower
 * accuracy than large/cloud models (acceptable for keyword signals),
 * English-only (matches our rule set), one-time model download (~40 MB,
 * cached), CPU inference of roughly real-time for short clips.
 */

const MAX_DURATION_SECONDS = 300;
const MIN_TRANSCRIPT_CHARS = 4;
const TRANSCRIBE_TIMEOUT_MS = 180_000;

/**
 * Transcription runs in a child process (transcribe.worker.mjs): the
 * transformers library is ESM-only and ONNX inference is the one component
 * that could segfault — isolating it keeps the API process immune either way.
 */
async function transcribe(samples: Float32Array): Promise<string> {
  const workerPath = path.resolve(__dirname, 'transcribe.worker.mjs');
  return new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath], { cwd: process.cwd() });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Transcription timed out'));
    }, TRANSCRIBE_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', () => {
      clearTimeout(timer);
      try {
        const result = JSON.parse(stdout.trim().split('\n').pop() ?? '{}');
        if (result.ok) resolve(result.text);
        else reject(new Error(result.error ?? 'Worker transcription failed'));
      } catch {
        reject(new Error(`Transcription worker produced no result${stderr ? `: ${stderr.slice(0, 200)}` : ''}`));
      }
    });

    const bytes = new Uint8Array(samples.buffer.slice(samples.byteOffset, samples.byteOffset + samples.byteLength));
    child.stdin.write(bytes);
    child.stdin.end();
  });
}

export interface AnalyzedAudio {
  risk_score: number;
  risk_reasons: string[];
  matches: { reason: string; excerpt: string }[];
  /**
   * Negative-signal categories that fired (e.g. the caller asked for
   * legitimate receiving-money details). Surfaced in the result UI as
   * "Routine context" so the user can see WHY a low-risk call is low-risk.
   */
  supporting_reasons: string[];
  duration_seconds: number;
  transcript_chars: number;
}

export async function analyzeAudioBuffer(
  buffer: Buffer,
  originalName: string,
): Promise<AnalyzedAudio> {
  const samples = await decode(buffer, originalName);
  const durationSeconds = samples.length / 16000;
  if (durationSeconds < 0.5) {
    throw new AudioDecodeError('AUDIO_TOO_SHORT', 'Recording must be at least half a second');
  }
  if (durationSeconds > MAX_DURATION_SECONDS) {
    throw new AudioDecodeError(
      'AUDIO_TOO_LONG',
      `Recording exceeds the ${MAX_DURATION_SECONDS}-second analysis limit`,
    );
  }

  const transcript = ((await transcribe(samples)) ?? '').trim();

  // A near-empty transcript carries no signal — score zero rather than guess.
  if (transcript.replace(/[^a-z']/gi, '').length < MIN_TRANSCRIPT_CHARS) {
    return {
      risk_score: 0,
      risk_reasons: [],
      supporting_reasons: [],
      matches: [],
      duration_seconds: Math.round(durationSeconds * 10) / 10,
      transcript_chars: transcript.length,
    };
  }

  const score = scoreTranscript(transcript);
  return {
    risk_score: score.risk_score,
    risk_reasons: score.risk_reasons,
    supporting_reasons: score.supporting_reasons,
    matches: score.matches,
    duration_seconds: Math.round(durationSeconds * 10) / 10,
    transcript_chars: transcript.length,
  };
}

async function decode(buffer: Buffer, originalName: string): Promise<Float32Array> {
  const name = originalName.toLowerCase();
  if (needsFfmpeg(name)) {
    return decodeViaFfmpeg(buffer);
  }
  try {
    return decodeWavTo16kMono(buffer);
  } catch (err) {
    if (err instanceof AudioDecodeError) {
      // The native parser only understands PCM16 WAV; uncommon encodings get
      // one attempt through host ffmpeg before we surface the error.
      try {
        return decodeViaFfmpeg(buffer);
      } catch {
        throw err;
      }
    }
    throw err;
  }
}
