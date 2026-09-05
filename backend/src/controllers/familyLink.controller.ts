import { Request, Response } from 'express';
import {
  acceptInvite as acceptInviteService,
  createInvite,
  listForUser,
} from '../services/familyLink.service';

export async function inviteController(req: Request, res: Response): Promise<void> {
  if (!req.user) return;
  res.json(await createInvite(req.user));
}

export async function acceptInviteController(req: Request, res: Response): Promise<void> {
  if (!req.user) return;
  const { invite_code } = req.body as { invite_code: string };
  res.json(await acceptInviteService(req.user, invite_code));
}

export async function listController(req: Request, res: Response): Promise<void> {
  if (!req.user) return;
  res.json(await listForUser(req.user));
}
