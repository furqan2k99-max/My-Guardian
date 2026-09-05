import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';

export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, 'NOT_FOUND', 'Endpoint not found'));
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.id;

  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, code: err.code, requestId });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: err.issues[0]?.message ?? 'Validation failed',
      code: 'VALIDATION_ERROR',
      requestId,
    });
    return;
  }

  // body-parser JSON/urlencoded parse failures arrive as SyntaxError with a
  // 4xx status and `expose` set — surface them as 4xx, not 500.
  if (err instanceof SyntaxError && typeof (err as { status?: number }).status === 'number') {
    const status = (err as { status?: number }).status as number;
    if (status >= 400 && status < 500) {
      res.status(status).json({
        error: 'Request body could not be parsed',
        code: 'INVALID_BODY',
        requestId,
      });
      return;
    }
  }

  logger.error({ err, requestId }, 'unhandled error');
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR', requestId });
}
