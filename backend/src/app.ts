import cors from 'cors';
import express, { Request as ExpressRequest } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger, newRequestId } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestContext } from './middleware/requestContext';
import { router as healthRouter } from './routes';
import { authRouter } from './routes/auth';
import { detectionRouter } from './routes/detection';
import { familyLinksRouter } from './routes/familyLinks';
import { pushRouter } from './routes/push';

const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
});

const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins.includes('*')
        ? true
        : corsOrigins[0] === '' || corsOrigins.length === 0
          ? false
          : corsOrigins,
    }),
  );
  app.use(requestContext);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as ExpressRequest).id ?? newRequestId(),
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  // Ops endpoints (unversioned)
  app.use(healthRouter);

  // Business API, versioned
  app.use('/api/v1', apiLimiter);
  app.use('/api/v1', authRouter);
  app.use('/api/v1', familyLinksRouter);
  app.use('/api/v1', detectionRouter);
  app.use('/api/v1', pushRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
