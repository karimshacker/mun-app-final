/**
 * IT admin app transport. Same classified-error contract as the organizer app
 * so both ships show the same sentences for the same failures.
 */
import { api as rawApi } from '@mianu/api-client';
import type { Participant } from '@mianu/types';

export type ApiError =
  | 'offline'
  | 'unauthorized'
  | 'conflict'
  | 'forbidden'
  | 'not_found'
  | 'server'
  | 'unknown';

export class ApiFailure extends Error {
  code: ApiError;
  constructor(code: ApiError) {
    super(code);
    this.code = code;
    this.name = 'ApiFailure';
  }
}

function classify(e: any): ApiFailure {
  const msg = String(e?.message ?? '');
  if (/network|fetch|failed to fetch|load failed/i.test(msg)) return new ApiFailure('offline');
  if (/http_401|unauthorized/.test(msg)) return new ApiFailure('unauthorized');
  if (/http_403|forbidden/.test(msg)) return new ApiFailure('forbidden');
  if (/http_409|conflict/.test(msg)) return new ApiFailure('conflict');
  if (/http_404|not_found/.test(msg)) return new ApiFailure('not_found');
  if (/http_5/.test(msg)) return new ApiFailure('server');
  return new ApiFailure('unknown');
}

export const api = {
  ...rawApi,
  async linkBadge({ participantId, badgeUid }: { participantId: string; badgeUid: string }) {
    try {
      return await rawApi.linkBadge({ participantId, badgeUid });
    } catch (e) {
      throw classify(e);
    }
  },
  async topUp({ altCode, amountCents, reason }: { altCode: string; amountCents: number; reason: string }) {
    try {
      return await rawApi.topUp({ altCode, amountCents, reason });
    } catch (e) {
      throw classify(e);
    }
  },
};

export async function findParticipant(_query: string): Promise<Participant | null> {
  // stub until /api/admin/participants?q= exists
  return null;
}
