import { z } from 'zod';
import { Role } from '@prisma/client';

export const loginSchema = z.object({
  role: z.enum([Role.elder, Role.guardian]),
  phone_number_hash: z.string().min(8, 'phone_number_hash must be a hash of the phone number'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const firebaseLoginSchema = z.object({
  role: z.enum([Role.elder, Role.guardian]),
  id_token: z.string().min(1, 'id_token is required'),
});

export type FirebaseLoginInput = z.infer<typeof firebaseLoginSchema>;
