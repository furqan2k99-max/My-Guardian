import { logger } from '../lib/logger';
import { Role } from '@prisma/client';
import { Router } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import type { NextFunction, Request, Response } from 'express';
import {
  analyzeAudioController,
  flagEventController,
  getEventController,
  listEventsController,
  reviewEventController,
  scanUrlController,
  setElderActionController,
} from '../controllers/detection.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  elderActionSchema,
  flagEventSchema,
  guardianReviewSchema,
  scanUrlSchema,
} from '../schemas/detection.schema';
import { AppError } from '../middleware/errorHandler';
import { flagEvent } from '../services/event.service';
import { scoreTranscript } from '../lib/scamRules';
import { EventType } from '@prisma/client';
import { analyzeTranscriptSemantic } from '../lib/analyzeTranscriptSemantic';

export const detectionRouter = Router();

// Audio analysis: memory storage only — bytes live in RAM for the duration of
// the request and are gone afterwards. 15 MB covers several minutes of voice.
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    const ok = /\.(wav|mp3|m4a|aac|ogg)$/i.test(file.originalname);
    if (!ok) {
      cb(new AppError(400, 'AUDIO_FORMAT_UNSUPPORTED', 'Supported formats: wav, mp3, m4a'));
      return;
    }
    cb(null, true);
  },
});

function uploadErrorHandler(
  err: unknown,
  _req: unknown,
  _res: Response,
  next: NextFunction,
): void {
  // Multer limit errors arrive as MulterError — surface them as 400s.
  if (err instanceof multer.MulterError) {
    next(new AppError(400, 'AUDIO_UPLOAD_INVALID', err.message));
    return;
  }
  next(err);
}

detectionRouter.post(
  '/detection/analyze-audio',
  // Multer runs BEFORE auth so the multipart body is always consumed —
  // rejecting pre-upload leaves the client's open stream hanging. Memory
  // exposure is bounded by the fileSize limit above.
  (req: Request & { file?: Express.Multer.File }, res: Response, next: NextFunction) => {
    audioUpload.single('audio')(req, res, (err) => uploadErrorHandler(err, req, res, next));
  },
  requireAuth,
  analyzeAudioController,
);

detectionRouter.post(
  '/detection/scan-url',
  requireAuth,
  validate(scanUrlSchema),
  scanUrlController,
);
detectionRouter.post(
  '/events',
  requireAuth,
  requireRole(Role.elder),
  validate(flagEventSchema),
  flagEventController,
);
detectionRouter.get('/events', requireAuth, listEventsController);
detectionRouter.get('/events/:id', requireAuth, getEventController);
detectionRouter.patch(
  '/events/:id/action',
  requireAuth,
  requireRole(Role.elder),
  validate(elderActionSchema),
  setElderActionController,
);
detectionRouter.patch(
  '/events/:id/review',
  requireAuth,
  requireRole(Role.guardian),
  validate(guardianReviewSchema),
  reviewEventController,
);

// Async semantic analysis: returns rule-based score immediately;
// if LOW/MEDIUM, triggers background Ollama analysis that may upgrade risk.
// If HIGH, skips semantic entirely to save latency/compute.
detectionRouter.post(
  '/analyze-transcript',
  requireAuth,
  async (req: Request & { user?: { id: string } }, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        next(new AppError(401, 'UNAUTHORIZED', 'User not authenticated'));
        return;
      }
      const { transcript } = req.body as { transcript: string };
      if (!transcript) {
        next(new AppError(400, 'MISSING_TRANSCRIPT', 'Transcript field is required'));
        return;
      }

      // 1. Run rule-based scorer immediately (fast, no LLM dependency)
      const ruleScore = scoreTranscript(transcript);

      // 2. If already HIGH (>= 70), skip semantic entirely to save latency/compute
      if (ruleScore.risk_score >= 70) {
        // Use EventType.call for phone-based scam detection
        await flagEvent(user, {
          event_type: EventType.call,
          sender_hash: user.id,
          risk_score: ruleScore.risk_score,
          risk_reasons: ruleScore.risk_reasons,
        });
        res.json({
          risk_level: ruleScore.risk_reasons.length > 0 ? 'HIGH' : 'LOW',
          risk_score: ruleScore.risk_score,
          upgraded: false,
          method: 'rules_only',
          risk_reasons: ruleScore.risk_reasons,
          supporting_reasons: ruleScore.supporting_reasons,
        });
        return;
      }

      // 3. If LOW/MEDIUM, queue semantic analysis asynchronously
      // Run inline (not child_process.fork) since the HTTP API is non-blocking
      analyzeTranscriptSemantic(transcript).then((semanticResult) => {
        if (semanticResult.risk_level === 'HIGH' && ruleScore.risk_score < 70) {
          const upgradedScore = Math.min(100, ruleScore.risk_score + 30);
          flagEvent(user, {
            event_type: EventType.call,
            sender_hash: user.id,
            risk_score: upgradedScore,
            risk_reasons: [...ruleScore.risk_reasons, ...(semanticResult.concerning_phrases || [])],
          }).catch((e) => logger.error({ err: e }, 'Flag event error in semantic upgrade'));
        }
      }).catch((e) => logger.error({ err: e }, 'Semantic analysis failed'));

      // Immediately acknowledge the rule-based result to the app
      res.json({
        risk_level: ruleScore.risk_reasons.length > 0 ? 'HIGH' : 'LOW',
        risk_score: ruleScore.risk_score,
        upgraded: false,
        method: 'rules_pending_semantic',
        risk_reasons: ruleScore.risk_reasons,
        supporting_reasons: ruleScore.supporting_reasons,
        transcript: transcript,
      });
    } catch (err) {
      next(err);
    }
  },
);