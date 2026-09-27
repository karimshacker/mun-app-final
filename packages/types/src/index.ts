/**
 * Shared domain types — used by both React Native apps and the Cloudflare workers.
 * Keep this file dependency-free.
 */

export type Role = 'HEAD' | 'DEPUTY' | 'ORGANIZER' | 'IT_ADMIN';

export type MealPlan = 'FULL' | 'BREAKFAST_ONLY' | 'LUNCH_ONLY' | 'NONE';

/**
 * The conference runs N days, and each day carries exactly two meal slots —
 * breakfast and lunch. A participant's entitlement is therefore the grid:
 * for a FULL plan over 3 days that is 6 meals, and one slot may only be
 * consumed once, so a double-scan at lunch is rejected while the next day's
 * lunch is still served.
 */
export const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH'];

export interface MealSlot {
  /** 1-based conference day */
  day: number;
  mealType: MealType;
}
export type MealType = 'BREAKFAST' | 'LUNCH';
export type ParticipantStatus = 'ACTIVE' | 'BLOCKED' | 'LEFT';

export interface Committee {
  id: string;
  name: string;
  hallName: string;
  hallTagUid: string | null;
}

/** Committee as served to the station picker (no tag internals). */
export interface CommitteeInfo {
  id: string;
  name: string;
  hallName: string;
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

/** A participant match from the IT admin search box. */
export interface ParticipantMatch {
  id: string;
  name: string;
  committeeId: string | null;
  committeeName: string | null;
  altCode: string;
  badgeUid: string | null;
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
  | 'MEAL'
  /** Free once-per-conference-day item (the journal). */
  | 'FREE_ITEM';

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
  | 'MEAL_PLAN_EXHAUSTED'
  | 'MEAL_DAY_CLOSED'
  | 'INSUFFICIENT_BALANCE'
  | 'MEAL_NOT_IN_PLAN'
  /** Free item handed over for today. */
  | 'ITEM_SERVED'
  /** The free item was already handed to this delegate today. */
  | 'ITEM_ALREADY_SERVED';

export interface ScanResult {
  outcome: ScanOutcome;
  participant: Participant | null;
  balanceCents?: number;
  /** How many meals the participant has left after this scan, if it was a meal. */
  mealsRemaining?: number;
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

/** One broadcast as it lands in an organizer's inbox. */
export interface NotificationItem {
  id: string;
  from: string;
  title: string;
  body: string;
  audience: string;
  at: string;
  /** ISO time the recipient read it, null while unread. */
  readAt: string | null;
}

/** HEAD composes one of these; fan-out to receipts happens server-side. */
export interface NotificationDraft {
  title: string;
  body: string;
  /** 'ALL' or a committee id. */
  audience: string;
}

/** One message in the head ↔ deputy channel. */
export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  body: string;
  at: string;
}

/** Participant presence row — the live "who is in which hall" board. */
export interface PresenceRow {
  participantId: string;
  name: string;
  committeeId: string | null;
  committeeName: string | null;
  inConference: boolean;
  hallId: string | null;
  hallName: string | null;
  inHallSince: string | null;
}

/**
 * One organizer on the head's dashboard. Position is derived, never precise:
 * hall-level from their own station scans, or a GPS fix while moving.
 */
export interface BoardRow {
  userId: string;
  name: string;
  role: Role;
  committeeId: string | null;
  onBreak: boolean;
  lat: number | null;
  lng: number | null;
  source: 'GPS' | 'HALL_SCAN' | null;
  /** ISO time of the last location report or station scan. */
  at: string | null;
  /** Station type of the organizer's most recent hall/meal scan. */
  lastStation: 'HALL_IN' | 'HALL_OUT' | 'MEAL' | null;
  /** Hall name of the organizer's most recent hall/meal scan. */
  lastHall: string | null;
}
