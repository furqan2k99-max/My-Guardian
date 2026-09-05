import { NextFunction, Request, Response } from 'express';
import { newRequestId } from '../lib/logger';

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  req.id = newRequestId();
  res.setHeader('X-Request-Id', req.id);
  next();
}
