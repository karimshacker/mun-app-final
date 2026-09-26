/**
 * Shared domain types — used by both React Native apps and the Cloudflare workers.
 * Keep this file dependency-free.
 */

export type Role = 'HEAD' | 'DEPUTY' | 'ORGANIZER' | 'IT_ADMIN';

export type MealPlan = 'FULL' | 'BREAKFAST_ONLY' | 'LUNCH_ONLY' | 'NONE';
export type MealType = 'BREAKFAST' | 'LUNCH';
export type ParticipantStatus = 'ACTIVE' | 'BLOCKED' | 'LEFT';

export interface Committee {
  id: string;
  name: string;
  hallName: string;
  hallTagUid: string | null;
}

export interface Participant {
  id: string;
  name: string;
  committeeId: string | null;
  badgeUid: string | null;
  altCode: string;
  balanceCents: number;
  mealPlan: MealPlan;
  status: ParticipantStatus;
}

/** Every check-in / check-out / meal scan lands here. */
export type StationType =
  | 'CONFERENCE_IN'
  | 'CONFERENCE_OUT'
  | 'HALL_IN'
  | 'HALL_OUT'
  | 'MEAL';

export type EntryMethod = 'NFC' | 'ALT_CODE';

export interface ScanRequest {
  /** Badge UID (NFC) or alt code (typed). Exactly one is set. */
  badgeUid?: string;
  altCode?: string;
  stationType: StationType;
  /** Committee for HALL_* / MEAL stations. */
  committeeId?: string;
  /** Which meal a MEAL station is serving. Required when stationType is MEAL. */
  mealType?: MealType;
  /** Idempotency key generated on-device; a retry must not double-commit. */
  clientScanId: string;
}

export type ScanOutcome =
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'ALREADY_IN'
  | 'ALREADY_OUT'
  | 'NOT_FOUND'
  | 'BLOCKED'
  | 'MEAL_SERVED'
  | 'MEAL_ALREADY_SERVED'
  | 'INSUFFICIENT_BALANCE'
  | 'MEAL_NOT_IN_PLAN';

export interface ScanResult {
  outcome: ScanOutcome;
  participant: Participant | null;
  balanceCents?: number;
  at: string;
}

export interface MealLedgerEntry {
  id: string;
  participantId: string;
  mealType: MealType;
  amountCents: number;
  reason: 'MEAL' | 'TOPUP' | 'COMP' | 'REFUND';
  at: string;
}

export interface WaterOrderRequest {
  committee: string;
  quantity: number;
  note?: string;
}

export interface WaterOrder {
  ref: string;
  committeeId: string;
  quantity: number;
  note: string | null;
  status: 'RECEIVED' | 'ACKNOWLEDGED' | 'DELIVERED' | 'CANCELLED';
  requesterSystem: string;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  committeeId: string | null;
}
