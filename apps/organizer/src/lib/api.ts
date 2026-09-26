/**
 * React-Native-facing wrapper around the shared typed client.
 *
 * The raw client lives in packages/api-client and knows nothing about React;
 * this module is the one place the organizer app reaches for the network, and
 * the one place that turns transport errors into copy the UI can show.
 */
import { api as rawApi } from '@mianu/api-client';
import type { ScanRequest, ScanResult } from '@mianu/types';

/**
 * Every failure surfaces as one of these short codes so a screen can render a
 * fixed, human sentence rather than a raw exception string.
 */
export type ApiError =
  | 'offline' // no connectivity — scan refused, per the no-offline requirement
  | 'unauthorized'
  | 'conflict' // duplicate client_scan_id, i.e. a retry already landed
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
  if (/http_409|conflict/.test(msg)) return new ApiFailure('conflict');
  if (/http_404|not_found/.test(msg)) return new ApiFailure('not_found');
  if (/http_5/.test(msg)) return new ApiFailure('server');
  return new ApiFailure('unknown');
}

export const api = {
  ...rawApi,
  /** Login, returning the session or a classified error. */
  async login(phone: string, pin: string) {
    try {
      return await rawApi.login(phone, pin);
    } catch (e) {
      throw classify(e);
    }
  },
  /**
   * Submit a scan. A 409 here is *success for the operator*: the server
   * already committed this exact client_scan_id, so the scan went through on
   * the first attempt and only the acknowledgement was lost. Callers treat
   * 'conflict' as "already done", not as an error.
   */
  async scan(req: ScanRequest): Promise<ScanResult> {
    try {
      return await rawApi.scan(req);
    } catch (e) {
      const err = classify(e);
      if (err.code === 'conflict') {
        return {
          outcome: 'ALREADY_IN',
          participant: null,
          at: new Date().toISOString(),
        };
      }
      throw err;
    }
  },
};
