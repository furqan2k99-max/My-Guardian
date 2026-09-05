import { ElderAction, EventType, GuardianAction } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import {
  analyzeAudioBuffer,
} from '../services/audioScam.service';
import {
  flagEvent as flagEventService,
  getEventForUser,
  listEvents,
  reviewEvent,
  setElderAction,
} from '../services/event.service';
import { scanUrl } from '../services/reputation.service';

export async function scanUrlController(req: Request, res: Response): Promise<void> {
  const { url } = req.body as { url: string };
  res.json(await scanUrl(url));
}

export async function flagEventController(req: Request, res: Response): Promise<void> {
  if (!req.user) return;
  const { event_type, sender_hash, risk_score, risk_reasons } = req.body as {
    event_type: EventType;
    sender_hash: string;
    risk_score: number | null;
    risk_reasons: string[];
  };
  res.json(await flagEventService(req.user, { event_type, sender_hash, risk_score, risk_reasons }));
}

export async function listEventsController(req: Request, res: Response): Promise<void> {
  if (!req.user) return;
  res.json(await listEvents(req.user));
}

export async function setElderActionController(req: Request, res: Response): Promise<void> {
  if (!req.user) return;
  const { elder_action } = req.body as { elder_action: ElderAction };
  const eventId = String(req.params.id);
  res.json(await setElderAction(req.user, eventId, elder_action));
}

export async function getEventController(req: Request, res: Response): Promise<void> {
  if (!req.user) return;
  const eventId = String(req.params.id);
  res.json(await getEventForUser(req.user, eventId));
}

export async function reviewEventController(req: Request, res: Response): Promise<void> {
  if (!req.user) return;
  const { action } = req.body as { action: GuardianAction };
  const eventId = String(req.params.id);
  res.json(await reviewEvent(req.user, eventId, action));
}

/**
 * Analyzes an uploaded recording (wav/mp3/m4a) for scam-pattern language.
 * The upload lives only in request memory (or a temp dir deleted within this
 * call for converted formats); the transcript itself is never returned.
 *
 * Accepts two shapes: multipart/form-data with an "audio" file field, OR a
 * raw audio/* body with ?filename=recording.<ext> (used by Expo clients,
 * whose fetch/FormData cannot send RN-style file parts).
 */
export async function analyzeAudioController(
  req: Request & { file?: Express.Multer.File },
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    const contentType = req.headers['content-type'] ?? '';

    let buffer: Buffer | null = null;
    let filename: string;

    if (file) {
      buffer = file.buffer;
      filename = file.originalname;
    } else if (contentType.startsWith('audio/')) {
      const requestedName = typeof req.query.filename === 'string' ? req.query.filename : '';
      filename = /\.(wav|mp3|m4a|aac|ogg)$/i.test(requestedName)
        ? requestedName
        : 'recording.m4a';
      buffer = await collectRawBody(req);
    } else {
      res.status(400).json({
        error: 'Attach an audio file in the "audio" field',
        code: 'AUDIO_FILE_REQUIRED',
        requestId: req.id,
      });
      return;
    }

    if (!buffer || buffer.length === 0) {
      res.status(400).json({
        error: 'Audio file was empty',
        code: 'AUDIO_FILE_EMPTY',
        requestId: req.id,
      });
      return;
    }

    res.json(await analyzeAudioBuffer(buffer, filename));
  } catch (err) {
    next(err);
  }
}

function collectRawBody(req: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
