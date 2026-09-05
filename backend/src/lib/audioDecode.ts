import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AppError } from '../middleware/errorHandler';

/**
 * Decodes uploaded audio into 16 kHz mono Float32 PCM for Whisper.
 *
 * WAV is parsed in-process (PCM16 only — the format our fixtures and most
 * voice recordings use). MP3/M4A are converted via an ffmpeg binary on PATH,
 * written to a private temp directory that is deleted synchronously in the
 * same request lifecycle — raw audio is never persisted anywhere.
 */
export class AudioDecodeError extends AppError {
  constructor(code: string, message: string) {
    super(400, code, message);
  }
}

const TARGET_RATE = 16000;

let cachedFfmpegPath: string | null | undefined;

/**
 * Resolves the ffmpeg executable. Bare 'ffmpeg' works on Linux/containers via
 * PATH; Windows contexts vary in whether spawn() PATH-searches (jest workers
 * don't), so we also check FFMPEG_PATH and the standard winget install dir.
 */
function ffmpegCommand(): string {
  if (cachedFfmpegPath !== undefined) return cachedFfmpegPath ?? 'ffmpeg';
  cachedFfmpegPath = 'ffmpeg';

  if (process.env.FFMPEG_PATH) {
    cachedFfmpegPath = process.env.FFMPEG_PATH;
    return cachedFfmpegPath;
  }

  if (process.platform === 'win32') {
    try {
      const wingetPackages = path.join(
        process.env.LOCALAPPDATA ?? '',
        'Microsoft',
        'WinGet',
        'Packages',
      );
      for (const pkg of readdirSync(wingetPackages)) {
        if (!pkg.toLowerCase().startsWith('gyan.ffmpeg')) continue;
        for (const build of readdirSync(path.join(wingetPackages, pkg))) {
          const exe = path.join(wingetPackages, pkg, build, 'bin', 'ffmpeg.exe');
          if (existsSync(exe)) {
            cachedFfmpegPath = exe;
            return cachedFfmpegPath;
          }
        }
      }
    } catch {
      /* no winget install — fall back to bare name */
    }
  }

  return cachedFfmpegPath;
}

export function decodeWavTo16kMono(buf: Buffer): Float32Array {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF') {
    throw new AudioDecodeError('AUDIO_FORMAT_UNSUPPORTED', 'File is not a RIFF/WAV stream');
  }
  let pos = 12;
  let fmt: { channels: number; rate: number; bits: number } | null = null;
  let data: Buffer | null = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ' && size >= 16) {
      fmt = {
        channels: buf.readUInt16LE(pos + 10),
        rate: buf.readUInt32LE(pos + 12),
        bits: buf.readUInt16LE(pos + 22),
      };
    } else if (id === 'data') {
      data = buf.subarray(pos + 8, Math.min(pos + 8 + size, buf.length));
    }
    pos += 8 + size + (size % 2);
  }
  if (!fmt || !data || fmt.bits !== 16) {
    throw new AudioDecodeError(
      'AUDIO_FORMAT_UNSUPPORTED',
      'Only 16-bit PCM WAV is supported natively (use ffmpeg on the host for other formats)',
    );
  }

  const bytesPerSample = 2;
  const frames = Math.floor(data.length / (bytesPerSample * fmt.channels));
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < fmt.channels; c++) {
      sum += data.readInt16LE((i * fmt.channels + c) * bytesPerSample) / 32768;
    }
    mono[i] = sum / fmt.channels;
  }
  return resampleTo16k(mono, fmt.rate);
}

function resampleTo16k(samples: Float32Array, rate: number): Float32Array {
  if (rate === TARGET_RATE) return samples;
  const outLen = Math.floor((samples.length * TARGET_RATE) / rate);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = (i * rate) / TARGET_RATE;
    const i0 = Math.floor(srcPos);
    const t = srcPos - i0;
    out[i] = samples[i0] * (1 - t) + (samples[i0 + 1] ?? samples[i0]) * t;
  }
  return out;
}

/** True for container formats we cannot parse in-process. */
export function needsFfmpeg(filename: string): boolean {
  return /\.(mp3|m4a|aac|ogg)$/i.test(filename);
}

/**
 * Converts non-WAV uploads to 16k WAV using host ffmpeg, decodes it, and
 * removes the temporary directory before returning. If anything throws, the
 * cleanup still runs — callers never need to remember to delete.
 */
export function decodeViaFfmpeg(buf: Buffer): Promise<Float32Array> {
  const dir = mkdtempSync(path.join(tmpdir(), 'mg-audio-'));
  return new Promise<Float32Array>((resolve, reject) => {
    try {
      const input = path.join(dir, 'input.raw');
      const output = path.join(dir, 'output.wav');
      writeFileSync(input, buf);
      const ff = spawn(ffmpegCommand(), [
        '-hide_banner', '-loglevel', 'error',
        '-i', input,
        '-ac', '1', '-ar', String(TARGET_RATE),
        '-sample_fmt', 's16',
        output,
      ]);
      let stderr = '';
      ff.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
      ff.on('error', (err) => {
        cleanup();
        reject(
          err.message.includes('ENOENT')
            ? new AudioDecodeError(
                'AUDIO_TOOLING_MISSING',
                'mp3/m4a decoding requires ffmpeg on the server PATH',
              )
            : new AudioDecodeError('AUDIO_DECODE_FAILED', 'Audio conversion failed'),
        );
      });
      ff.on('close', (code) => {
        try {
          if (code !== 0) {
            throw new AudioDecodeError(
              'AUDIO_DECODE_FAILED',
              `ffmpeg exited ${code}${stderr ? `: ${stderr.slice(0, 200)}` : ''}`,
            );
          }
          resolve(decodeWavTo16kMono(readFileSync(output)));
        } catch (err) {
          reject(err);
        } finally {
          cleanup();
        }
      });
    } catch (err) {
      cleanup();
      reject(err);
    }
  });

  function cleanup() {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }
}