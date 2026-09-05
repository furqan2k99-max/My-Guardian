import { Router } from 'express';
import { env } from '../config/env';
import { devLoginController, firebaseLoginController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { firebaseLoginSchema, loginSchema } from '../schemas/auth.schema';

export const authRouter = Router();

// Real login: Firebase ID token (phone-auth) -> verified session.
authRouter.post('/auth/firebase-login', validate(firebaseLoginSchema), firebaseLoginController);

// Dev stand-in. Registered ONLY when not in production, so it is unreachable
// in a real deployment (belt-and-braces on top of the service-level guard).
if (env.NODE_ENV !== 'production') {
  authRouter.post('/auth/dev-login', validate(loginSchema), devLoginController);
}