import { Router } from 'express';
import { healthController } from '../controllers/health.controller';
import { readinessController } from '../controllers/readiness.controller';

export const router = Router();

router.get('/health', healthController);
router.get('/health/ready', readinessController);
