/**
 * IT admin app transport. Same classified-error contract as the organizer app
 * so both ships show the same sentences for the same failures.
 *
 * The raw client is a class instance — methods live on the prototype — so
 * every method is bound explicitly rather than spread.
 */
import { api as rawApi, ApiError } from '@mianu/api-client';
import type { CommitteeInfo, ParticipantMatch } from '@mianu/types';

export type ApiErrorKind =
  | 'offline'
  | 'unauthorized'
  | 'conflict'
  | 'forbidden'
  | 'not_found'
  | 'server'
  | 'unknown';

export class ApiFailure extends Error {
  code: ApiErrorKind;
  constructor(code: ApiErrorKind) {
    super(code);
    this.code = code;
    this.name = 'ApiFailure';
  }
}

function classify(e: unknown): ApiFailure {
  if (e instanceof ApiFailure) return e as ApiFailure;
  const status = e instanceof ApiError ? e.status : 0;
  const code = e instanceof ApiError ? e.code : String((e as any)?.message ?? '');
  if (status === 0 || code === 'offline') return new ApiFailure('offline');
  if (status === 401 || code.includes('unauthorized') || code.includes('invalid_token')) {
    return new ApiFailure('unauthorized');
  }
  if (status === 403 || code === 'forbidden') return new ApiFailure('forbidden');
  if (status === 409 || code.includes('conflict') || code.includes('already_linked')) {
    return new ApiFailure('conflict');
  }
  if (status === 404 || code.includes('not_found')) return new ApiFailure('not_found');
  if (status >= 500) return new ApiFailure('server');
  return new ApiFailure('unknown');
}

export const api = {
  setSession: rawApi.setSession.bind(rawApi),
  hasSession: rawApi.hasSession.bind(rawApi),
  onSession: null as typeof rawApi.onSession,
  onAuthLost: null as typeof rawApi.onAuthLost,

  async login(phone: string, pin: string) {
    try {
      return await rawApi.login(phone, pin);
    } catch (e) {
      throw classify(e);
    }
  },
  async signOut(): Promise<void> {
    await rawApi.signOut();
  },

  /** Roster search for the link / top-up flows. */
  async searchParticipants(query: string): Promise<ParticipantMatch[]> {
    try {
      const { participants } = await rawApi.searchParticipants(query);
      return participants;
    } catch (e) {
      throw classify(e);
    }
  },
  /** Committee options for the enrollment picker. */
  async searchCommittees(): Promise<CommitteeInfo[]> {
    try {
      const { committees } = await rawApi.committees();
      return committees;
    } catch (e) {
      throw classify(e);
    }
  },
  /** Exact alt-code lookup for the top-up flow. */
  async lookupAltCode(altCode: string): Promise<ParticipantMatch | null> {
    try {
      const { participant } = await rawApi.lookupAltCode(altCode);
      return participant;
    } catch (e) {
      throw classify(e);
    }
  },
  /** Exact badge-UID lookup for the tap-to-top-up flow. */
  async lookupBadgeUid(badgeUid: string): Promise<ParticipantMatch | null> {
    try {
      const { participant } = await rawApi.lookupBadgeUid(badgeUid);
      return participant;
    } catch (e) {
      throw classify(e);
    }
  },
  async linkBadge(args: { participantId: string; badgeUid: string; altCode: string }) {
    try {
      return await rawApi.linkBadge(args);
    } catch (e) {
      throw classify(e);
    }
  },
  async enrollBadge(args: {
    badgeUid: string;
    name: string;
    committeeId: string;
    altCode: string;
    mealPlan?: 'FULL' | 'BREAKFAST_ONLY' | 'LUNCH_ONLY' | 'NONE';
  }) {
    try {
      return await rawApi.enrollBadge(args);
    } catch (e) {
      throw classify(e);
    }
  },
  async topUp(args: { altCode: string; amountCents: number; reason: string }) {
    try {
      return await rawApi.topUp(args);
    } catch (e) {
      throw classify(e);
    }
  },
};

export { classify };
