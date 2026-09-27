/**
 * Thin typed client for the MIANU-SM IV API. Shared by the organizer and
 * IT admin apps. One file, no codegen needed yet — it mirrors the routes in
 * workers/api/src/index.ts and workers/public/src/index.ts.
 *
 * Auth: a short-lived access token is attached to every request; when it
 * expires (401) the client silently exchanges the long-lived refresh token
 * once and retries. If the refresh itself is rejected the session is cleared
 * and the app is told to show the login screen.
 */

import type {
  AuthSession,
  BoardRow,
  ChatMessage,
  CommitteeInfo,
  NotificationDraft,
  NotificationItem,
  ParticipantMatch,
  PresenceRow,
  ScanRequest,
  ScanResult,
  User,
} from '@mianu/types';

const BASE = (process.env.EXPO_PUBLIC_API_URL as string) ?? 'http://localhost:8787';

type Opts = { signal?: AbortSignal };

/** Every failed request throws this; `code` is the server's error string. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  /** Set by the app shell: persists a session (or clears it on null). */
  onSession: ((s: AuthSession | null) => void) | null = null;
  /** Set by the app shell: called when the refresh token is no longer valid. */
  onAuthLost: (() => void) | null = null;

  setSession(s: AuthSession | null) {
    this.accessToken = s?.accessToken ?? null;
    this.refreshToken = s?.refreshToken ?? null;
    this.onSession?.(s);
  }

  hasSession(): boolean {
    return this.accessToken !== null || this.refreshToken !== null;
  }

  private async request<T>(path: string, init: RequestInit & Opts = {}, retry = true): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    if (this.accessToken) headers.set('Authorization', `Bearer ${this.accessToken}`);

    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, { ...init, headers, signal: init.signal });
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
      // fetch rejects with TypeError on connectivity loss — surface it as a
      // stable code so screens can say "offline" instead of a stack trace.
      throw new ApiError(0, 'offline');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const code = body.error ?? `http_${res.status}`;

      // Access token expired: refresh once, then replay the request once.
      if (res.status === 401 && retry && this.refreshToken && !path.startsWith('/api/auth/')) {
        if (await this.refreshSession()) {
          return this.request<T>(path, init, false);
        }
      }
      if (res.status === 401 && !path.startsWith('/api/auth/')) {
        this.setSession(null);
        this.onAuthLost?.();
      }
      throw new ApiError(res.status, code);
    }
    return res.json() as Promise<T>;
  }

  private async refreshSession(): Promise<boolean> {
    if (!this.refreshToken) return false;
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      if (!res.ok) {
        this.setSession(null);
        this.onAuthLost?.();
        return false;
      }
      const session = (await res.json()) as AuthSession;
      this.setSession(session);
      return true;
    } catch {
      return false; // offline — keep tokens, retry on the next request
    }
  }

  // ------------------------------------------------------------------ auth

  async login(phone: string, pin: string): Promise<AuthSession> {
    const session = await this.request<AuthSession>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, pin }),
    });
    this.setSession(session);
    return session;
  }

  /** Best-effort server-side invalidation; the local session is always cleared. */
  async signOut(): Promise<void> {
    const refreshToken = this.refreshToken;
    this.setSession(null);
    if (!refreshToken) return;
    try {
      await this.request('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }, false);
    } catch {
      // session already cleared locally; nothing to do about the server copy
    }
  }

  // ----------------------------------------------------------------- scan

  scan(req: ScanRequest) {
    return this.request<ScanResult>('/api/scan', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  /** Committee list for the station picker. */
  committees() {
    return this.request<{ committees: CommitteeInfo[] }>('/api/committees');
  }

  // ------------------------------------------------------- it admin: roster

  /** Search participants by name or alt code for the link / top-up flows. */
  searchParticipants(query: string) {
    return this.request<{ participants: ParticipantMatch[] }>(
      `/api/admin/participants?q=${encodeURIComponent(query)}`,
    );
  }

  /** Exact participant lookup by printed alt code (top-up flow). */
  lookupAltCode(altCode: string) {
    return this.request<{ participant: ParticipantMatch | null }>(
      `/api/admin/lookup?altCode=${encodeURIComponent(altCode)}`,
    );
  }

  /** Exact participant lookup by linked badge UID (tap to top-up). */
  lookupBadgeUid(badgeUid: string) {
    return this.request<{ participant: ParticipantMatch | null }>(
      `/api/admin/lookup?badgeUid=${encodeURIComponent(badgeUid)}`,
    );
  }

  /**
   * IT_ADMIN: bind a pre-printed badge UID to a participant. The participant's
   * printed alt code is required — the server stores it in the same update so
   * the typed fallback always matches the chip it was issued with.
   */
  linkBadge({ participantId, badgeUid, altCode }: { participantId: string; badgeUid: string; altCode: string }) {
    return this.request<{ ok: true }>('/api/admin/link-badge', {
      method: 'POST',
      body: JSON.stringify({ participantId, badgeUid, altCode }),
    });
  }

  /**
   * IT_ADMIN: enroll a delegate at the desk — create the participant from the
   * operator's details and bind the scanned chip in one atomic call.
   */
  enrollBadge(args: {
    badgeUid: string;
    name: string;
    committeeId: string;
    altCode: string;
    mealPlan?: 'FULL' | 'BREAKFAST_ONLY' | 'LUNCH_ONLY' | 'NONE';
  }) {
    return this.request<{ ok: true; participantId: string }>('/api/admin/enroll', {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  /** IT_ADMIN: adjust a participant balance. Ledger row records the reason. */
  topUp({ altCode, amountCents, reason }: { altCode: string; amountCents: number; reason: string }) {
    return this.request<{ balanceCents: number }>('/api/admin/topup', {
      method: 'POST',
      body: JSON.stringify({ altCode, amountCents, reason }),
    });
  }

  // ---------------------------------------------------------- notifications

  notifications() {
    return this.request<{ notifications: NotificationItem[] }>('/api/notifications');
  }

  markNotificationRead(id: string) {
    return this.request<{ ok: true }>(`/api/notifications/${id}/read`, { method: 'POST' });
  }

  /** HEAD/DEPUTY: compose a broadcast. Fan-out happens server-side. */
  sendNotification(draft: NotificationDraft) {
    return this.request<{ notification: NotificationItem }>('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(draft),
    });
  }

  // ------------------------------------------------------------------- chat

  chatMessages(since?: string) {
    const q = since ? `?since=${encodeURIComponent(since)}` : '';
    return this.request<{ messages: ChatMessage[] }>(`/api/chat${q}`);
  }

  sendChatMessage(body: string) {
    return this.request<{ message: ChatMessage }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }

  // --------------------------------------------------------------- presence

  /** HEAD/DEPUTY: who is in the building and in which hall, right now. */
  presence() {
    return this.request<{ rows: PresenceRow[] }>('/api/presence');
  }

  /** HEAD: the organizer-location dashboard (hybrid GPS + hall scan). */
  board() {
    return this.request<{ rows: BoardRow[] }>('/api/board');
  }

  /** Report this organizer's GPS position while on duty. */
  setLocation(lat: number, lng: number) {
    return this.request<{ ok: true }>('/api/location', {
      method: 'POST',
      body: JSON.stringify({ lat, lng }),
    });
  }

  /** The privacy toggle: go invisible on the head's board while on break. */
  setBreak(onBreak: boolean) {
    return this.request<{ ok: true }>('/api/me/break', {
      method: 'POST',
      body: JSON.stringify({ onBreak }),
    });
  }

  // ------------------------------------------------------------------- push

  /** Register this device's Web Push subscription for broadcast delivery. */
  registerPush(subscription: unknown) {
    return this.request<{ ok: true }>('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription }),
    });
  }
}

export const api = new ApiClient();

/**
 * Pull the badge UID out of whatever react-native-nfc-manager hands back.
 * NDEF tech exposes a byte array (`tag.id`); the low-level NfcA/NfcB/NfcV/
 * NfcF techs expose a hex string (`tag.id`); some Android bridges surface
 * `serialNumber`. All are normalized to lowercase hex with no separators.
 */
export function readNfcUid(tag: unknown): string | null {
  const t = tag as { id?: unknown; serialNumber?: unknown } | null;
  const raw = t?.id ?? t?.serialNumber;
  if (Array.isArray(raw)) {
    const bytes = raw as unknown[];
    if (bytes.length === 0) return null;
    return bytes
      .map((b) => Number(b).toString(16).padStart(2, '0'))
      .join('')
      .toLowerCase();
  }
  if (typeof raw === 'string' && raw.replace(/[^0-9a-fA-F]/g, '').length > 0) {
    return raw.replace(/[:\s-]/g, '').toLowerCase();
  }
  return null;
}

export { User };
