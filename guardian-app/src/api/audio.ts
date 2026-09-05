import { API_V1_URL } from './client';
import { ApiRequestError } from './client';
import type { ApiErrorBody } from './types';
import { File } from 'expo-file-system';

export interface ScamMatch {
  reason: string;
  excerpt: string;
}

export interface AudioAnalysisResult {
  risk_score: number;
  risk_reasons: string[];
  /**
   * Negative-signal categories that fired. Surfaced in the result UI as
   * "Routine context" so the user understands why a low-risk call is
   * low-risk (e.g. the caller was asking for a wire transfer with normal
   * account details).
   */
  supporting_reasons?: string[];
  matches: ScamMatch[];
  duration_seconds: number;
  transcript_chars: number;
}

function mimeFor(extension: string): string {
  switch (extension) {
    case 'wav':
      return 'audio/wav';
    case 'mp3':
      return 'audio/mpeg';
    case 'aac':
      return 'audio/aac';
    case 'ogg':
      return 'audio/ogg';
    default:
      return 'audio/m4a';
  }
}

/**
 * Uploads a recording to the demo audio-analysis endpoint as raw bytes with
 * an audio/* content-type. Expo 57's expo/fetch FormData does not support
 * React Native-style {uri} parts, and raw bytes sidestep that entire mess.
 * The filename travels as a query param so the backend knows the container.
 */
export async function analyzeAudioFile(
  token: string,
  uri: string,
): Promise<AudioAnalysisResult> {
  const extension = uri.split('.').pop()?.toLowerCase() ?? 'm4a';
  const file = new File(uri);
  const bytes = await file.bytes();

  let response: Response;
  try {
    response = await fetch(
      `${API_V1_URL}/detection/analyze-audio?filename=recording.${extension}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': mimeFor(extension),
        },
        body: bytes,
      },
    );
  } catch (err) {
    // Surface the underlying reason — demo failures are worth seeing on screen.
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Upload failed: ${reason}`);
  }

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiRequestError(response.status, (payload as ApiErrorBody) ?? {
      error: 'Analysis failed',
      code: 'UNKNOWN',
      requestId: '',
    });
  }

  return payload as AudioAnalysisResult;
}