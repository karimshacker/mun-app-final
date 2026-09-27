/**
 * React-Native-facing wrapper around the shared typed client.
 *
 * The raw client lives in packages/api-client and knows nothing about React;
 * this module is the one place the organizer app reaches for the network, and
 * the one place that turns transport errors into copy the UI can show.
 *
 * The raw client is a class instance, so its methods live on the prototype:
 * spreading it into an object literal would silently drop every method. This
 * wrapper therefore binds each method explicitly.
 */
import { api as rawApi, ApiError } from '@mianu/api-client';
import type {
  BoardRow,
  ChatMessage,
  CommitteeInfo,
  NotificationDraft,
  NotificationItem,
  ParticipantMatch,
  PresenceRow,
  ScanRequest,
  ScanResult,
  AuthSession,
} from '@mianu/types';

/**
 * Every failure surfaces as one of these short codes so a screen can render a
 * fixed, human sentence rather than a raw exception string.
 */
export type ApiErrorKind =
  | 'offline' // no connectivity — scan refused, per the no-offline requirement
  | 'unauthorized'
  | 'forbidden'
  | 'conflict' // duplicate client_scan_id, i.e. a retry already landed
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

/**
 * The API surface of the organizer app. Methods that can fail go through
 * `classify`; pure pass-throughs are bound straight off the raw client.
 */
export const api = {
  setSession: rawApi.setSession.bind(rawApi),
  hasSession: rawApi.hasSession.bind(rawApi),
  onSession: null as typeof rawApi.onSession,
  onAuthLost: null as typeof rawApi.onAuthLost,

  // auth
  async login(phone: string, pin: string): Promise<AuthSession> {
    try {
      return await rawApi.login(phone, pin);
    } catch (e) {
      throw classify(e);
    }
  },
  async signOut(): Promise<void> {
    await rawApi.signOut();
  },

  // scanning
  async scan(req: ScanRequest): Promise<ScanResult> {
    try {
      return await rawApi.scan(req);
    } catch (e) {
      const err = classify(e);
      // A 409 here is *success for the operator*: the server already committed
      // this exact client_scan_id, so the scan went through on the first
      // attempt and only the acknowledgement was lost.
      if (err.code === 'conflict') {
        return { outcome: 'ALREADY_IN', participant: null, at: new Date().toISOString() };
      }
      throw err;
    }
  },
  async committees(): Promise<{ committees: CommitteeInfo[] }> {
    try {
      return await rawApi.committees();
    } catch (e) {
      throw classify(e);
    }
  },

  // notifications
  async notifications(): Promise<{ notifications: NotificationItem[] }> {
    try {
      return await rawApi.notifications();
    } catch (e) {
      throw classify(e);
    }
  },
  markNotificationRead: (id: string) => rawApi.markNotificationRead(id),
  async sendNotification(draft: NotificationDraft) {
    try {
      return await rawApi.sendNotification(draft);
    } catch (e) {
      throw classify(e);
    }
  },

  // chat
  async chatMessages(since?: string): Promise<{ messages: ChatMessage[] }> {
    try {
      return await rawApi.chatMessages(since);
    } catch (e) {
      throw classify(e);
    }
  },
  async sendChatMessage(body: string): Promise<{ message: ChatMessage }> {
    try {
      return await rawApi.sendChatMessage(body);
    } catch (e) {
      throw classify(e);
    }
  },

  // presence / board / location
  async presence(): Promise<{ rows: PresenceRow[] }> {
    try {
      return await rawApi.presence();
    } catch (e) {
      throw classify(e);
    }
  },
  async board(): Promise<{ rows: BoardRow[] }> {
    try {
      return await rawApi.board();
    } catch (e) {
      throw classify(e);
    }
  },
  async setLocation(lat: number, lng: number): Promise<void> {
    try {
      await rawApi.setLocation(lat, lng);
    } catch (e) {
      throw classify(e);
    }
  },
  setBreak: (onBreak: boolean) => rawApi.setBreak(onBreak),
  registerPush: (subscription: unknown) => rawApi.registerPush(subscription),
};

export { classify };
