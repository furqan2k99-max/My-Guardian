import { apiRequest } from './client';
import type { FamilyLink, InviteResponse } from './types';

/** Guardian generates a pairing invite code (POST /api/v1/family-links/invite). */
export function createInvite(token: string): Promise<InviteResponse> {
  return apiRequest<InviteResponse>('/family-links/invite', { method: 'POST', token });
}

/**
 * Elder accepts an invite (POST /api/v1/family-links/accept).
 * NOTE: the backend role-guards this to `elder` only — a guardian gets 403.
 * Included here so the paired flow has its full API surface; the guardian app
 * pairs by generating a code and polling `listFamilyLinks`.
 */
export function acceptInvite(token: string, inviteCode: string): Promise<FamilyLink> {
  return apiRequest<FamilyLink>('/family-links/accept', {
    method: 'POST',
    token,
    body: { invite_code: inviteCode },
  });
}

/** List the caller's family links (GET /api/v1/family-links). */
export function listFamilyLinks(token: string): Promise<FamilyLink[]> {
  return apiRequest<FamilyLink[]>('/family-links', { token });
}