export type Role = 'elder' | 'guardian';

export type FamilyLinkStatus = 'pending' | 'active';

export interface User {
  id: string;
  role: Role;
  phone_number_hash: string;
  created_at: string;
}

export interface FamilyLink {
  id: string;
  elder_user_id: string;
  guardian_user_id: string;
  status: FamilyLinkStatus;
  created_at: string;
  elder_user?: User;
  guardian_user?: User;
}

export interface DevLoginResponse {
  token: string;
  user: User;
}

export interface InviteResponse {
  invite_code: string;
}

export type EventType = 'call' | 'sms' | 'email';

export type ElderAction = 'dismissed' | 'blocked' | 'no_action';

export type GuardianAction = 'reviewed' | 'dismissed';

/** A flagged communication event, as returned by GET /api/v1/events.
 *  Guardian callers get `elder_user` embedded (the linked elder it came from). */
export interface FlaggedEvent {
  id: string;
  elder_user_id: string;
  event_type: EventType;
  sender_hash: string;
  risk_score: number | null;
  risk_reasons: string[];
  created_at: string;
  guardian_notified_at: string | null;
  elder_action: ElderAction;
  guardian_action: GuardianAction | null;
  guardian_reviewed_at: string | null;
  elder_user?: User;
}

export interface ApiErrorBody {
  error: string;
  code: string;
  requestId: string;
}