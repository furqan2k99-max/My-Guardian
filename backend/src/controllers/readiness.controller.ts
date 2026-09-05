import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { logger } from '../lib/logger';

export async function readinessController(_req: Request, res: Response): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch (err) {
    logger.error({ err }, 'readiness check failed — database unreachable');
    res.status(503).json({ status: 'unavailable' });
  }
}
