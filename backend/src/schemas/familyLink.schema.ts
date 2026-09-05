import { z } from 'zod';

export const acceptInviteSchema = z.object({
  invite_code: z.string().min(1, 'invite_code is required'),
});

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
