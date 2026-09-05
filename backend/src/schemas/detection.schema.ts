import { z } from 'zod';
import { ElderAction, EventType, GuardianAction } from '@prisma/client';

export const scanUrlSchema = z.object({
  url: z.string().url('url must be a valid URL'),
});

export const flagEventSchema = z.object({
  event_type: z.enum([EventType.call, EventType.sms, EventType.email, EventType.link]),
  sender_hash: z.string().min(1, 'sender_hash is required'),
  risk_score: z.number().min(0).max(100).nullable().optional(),
  risk_reasons: z.array(z.string().min(1)).max(50).default([]),
});

export const elderActionSchema = z.object({
  elder_action: z.enum([ElderAction.dismissed, ElderAction.blocked, ElderAction.no_action]),
});

export const guardianReviewSchema = z.object({
  action: z.enum([GuardianAction.reviewed, GuardianAction.dismissed]),
});

export type FlagEventInput = z.infer<typeof flagEventSchema>;
export type GuardianReviewInput = z.infer<typeof guardianReviewSchema>;
