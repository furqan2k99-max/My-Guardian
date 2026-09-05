import { Request, Response } from 'express';
import {
  listDeviceTokens,
  registerDeviceToken,
  unregisterDeviceToken,
} from '../services/push.service';

export async function registerTokenController(req: Request, res: Response): Promise<void> {
  if (!req.user) return;
  const { token, platform } = req.body as { token: string; platform: 'android' | 'ios' | 'web' };
  await registerDeviceToken(req.user, token, platform);
  res.status(201).json({ registered: true });
}

export async function unregisterTokenController(req: Request, res: Response): Promise<void> {
  if (!req.user) return;
  const token = String(req.params.token);
  await unregisterDeviceToken(req.user, token);
  res.json({ registered: false });
}

export async function listTokensController(req: Request, res: Response): Promise<void> {
  if (!req.user) return;
  res.json(await listDeviceTokens(req.user));
}