/**
 * Thin typed client for the MIANU-SM IV API. Shared by the organizer and
 * IT admin apps. One file, no codegen needed yet — it mirrors the routes in
 * workers/api/src/index.ts and workers/public/src/index.ts.
 */

import type {
  AuthSession,
  ScanRequest,
  ScanResult,
  User,
} from '@mianu/types';

const BASE = (process.env.EXPO_PUBLIC_API_URL as string) ?? 'http://localhost:8787';

type Opts = { signal?: AbortSignal };

class ApiClient {
  private accessToken: string | null = null;

  setSession(session: AuthSession) {
    this.accessToken = session.accessToken;
    // refresh token persists in secure storage; the apps handle the refresh
    // dance on a 401.
  }

  private async request<T>(path: string, init: RequestInit & Opts = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    if (this.accessToken) headers.set('Authorization', `Bearer ${this.accessToken}`);

    const res = await fetch(`${BASE}${path}`, { ...init, headers, signal: init.signal });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `http_${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  login(phone: string, pin: string) {
    return this.request<AuthSession>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, pin }),
    });
  }

  scan(req: ScanRequest) {
    return this.request<ScanResult>('/api/scan', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  /** HEAD/DEPUTY: who is in the building and in which hall, right now. */
  presence() {
    return this.request<Array<{
      participantId: string;
      name: string;
      inConference: boolean;
      hallId: string | null;
    }>>('/api/presence');
  }

  waterOrders() {
    return this.request<Array<{ ref: string; quantity: number; status: string }>>(
      '/api/water-orders',
    );
  }

  /** IT_ADMIN: bind a pre-printed badge UID to a participant. */
  linkBadge({ participantId, badgeUid }: { participantId: string; badgeUid: string }) {
    return this.request<{ ok: true }>('/api/admin/link-badge', {
      method: 'POST',
      body: JSON.stringify({ participantId, badgeUid }),
    });
  }

  /** IT_ADMIN: adjust a participant balance. Ledger row records the reason. */
  topUp({ altCode, amountCents, reason }: { altCode: string; amountCents: number; reason: string }) {
    return this.request<{ balanceCents: number }>('/api/admin/topup', {
      method: 'POST',
      body: JSON.stringify({ altCode, amountCents, reason }),
    });
  }
}

export const api = new ApiClient();

export { User };
