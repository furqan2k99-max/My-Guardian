import { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from './errorHandler';

export type RequestPart = 'body' | 'query' | 'params';

/**
 * Generic request-validation middleware backed by Zod.
 * Plumbed in for the upcoming auth/family-linking endpoints;
 * the skeleton's only endpoint (/health) needs no input validation.
 */
export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'Validation failed';
      next(new AppError(400, 'VALIDATION_ERROR', message));
      return;
    }
    Object.assign(req[part], result.data);
    next();
  };
}
