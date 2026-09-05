import { Role } from '@prisma/client';
import { Request, Response } from 'express';
import { devLogin, firebaseLogin } from '../services/auth.service';

export async function devLoginController(req: Request, res: Response): Promise<void> {
  const { role, phone_number_hash } = req.body as { role: Role; phone_number_hash: string };
  res.json(await devLogin(role, phone_number_hash));
}

export async function firebaseLoginController(req: Request, res: Response): Promise<void> {
  const { role, id_token } = req.body as { role: Role; id_token: string };
  res.json(await firebaseLogin(role, id_token));
}