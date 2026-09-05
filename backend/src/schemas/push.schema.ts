import { z } from 'zod';

export const registerPushTokenSchema = z.object({
  token: z.string().min(1, 'token is required'),
  platform: z.enum(['android', 'ios', 'web']),
});

export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;