import { apiRequest } from './client';
import type { FlaggedEvent, GuardianAction } from './types';

/**
 * Guardian's flagged-events feed (GET /api/v1/events).
 * For a guardian the backend returns events for every elder it has an active
 * link with, newest first, each with the `elder_user` embedded.
 */
export function listEvents(token: string): Promise<FlaggedEvent[]> {
  return apiRequest<FlaggedEvent[]>('/events', { token });
}

/** Fetches one flagged event (guardian must be linked to the event's elder). */
export function getEvent(token: string, eventId: string): Promise<FlaggedEvent> {
  return apiRequest<FlaggedEvent>(`/events/${eventId}`, { token });
}

/** Records the guardian's review of a flagged event. */
export function reviewEvent(
  token: string,
  eventId: string,
  action: GuardianAction,
): Promise<FlaggedEvent> {
  return apiRequest<FlaggedEvent>(`/events/${eventId}/review`, {
    method: 'PATCH',
    token,
    body: { action },
  });
}