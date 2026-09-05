import { Role } from '@prisma/client';
import { Router } from 'express';
import {
  acceptInviteController,
  inviteController,
  listController,
} from '../controllers/familyLink.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { acceptInviteSchema } from '../schemas/familyLink.schema';

export const familyLinksRouter = Router();

familyLinksRouter.post(
  '/family-links/invite',
  requireAuth,
  requireRole(Role.guardian),
  inviteController,
);
familyLinksRouter.post(
  '/family-links/accept',
  requireAuth,
  requireRole(Role.elder),
  validate(acceptInviteSchema),
  acceptInviteController,
);
familyLinksRouter.get('/family-links', requireAuth, listController);
