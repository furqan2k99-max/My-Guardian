import { Request, Response } from 'express';
import { getHealthStatus } from '../services/health.service';

export function healthController(_req: Request, res: Response): void {
  res.json(getHealthStatus());
}
