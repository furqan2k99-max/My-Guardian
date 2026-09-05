import { Router } from 'express';
import {
  listTokensController,
  registerTokenController,
  unregisterTokenController,
} from '../controllers/push.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { registerPushTokenSchema } from '../schemas/push.schema';

export const pushRouter = Router();

pushRouter.post('/push/tokens', requireAuth, validate(registerPushTokenSchema), registerTokenController);
pushRouter.delete('/push/tokens/:token', requireAuth, unregisterTokenController);
pushRouter.get('/push/tokens', requireAuth, listTokensController);