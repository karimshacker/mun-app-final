/**
 * Session persistence for the organizer app.
 *
 * The refresh token is the long-lived credential, so it is written to the
 * app's private documents directory via expo-file-system — not localStorage,
 * not AsyncStorage — and is never logged. On cold start the session is
 * restored and handed to the API client before the first render, so a killed
 * app comes back already signed in.
 */
// SDK 57: the classic readAsStringAsync/writeAsStringAsync API lives in the
// legacy entry point; the default entry is the new functional API.
import * as FileSystem from 'expo-file-system/legacy';
import { api } from './api';
import type { AuthSession } from '@mianu/types';

const FILE = `${FileSystem.documentDirectory}session.json`;

export async function restoreSession(): Promise<AuthSession | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(FILE);
    const session = JSON.parse(raw) as AuthSession;
    if (!session?.accessToken || !session?.refreshToken) return null;
    api.setSession(session);
    return session;
  } catch {
    return null; // no file / unreadable — treat as signed out
  }
}

async function writeSessionFile(session: AuthSession): Promise<void> {
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(session));
}

export async function persistSession(session: AuthSession | null): Promise<void> {
  api.setSession(session);
  if (!session) {
    try {
      await FileSystem.deleteAsync(FILE, { idempotent: true });
    } catch {
      // nothing persisted yet — fine
    }
    return;
  }
  await writeSessionFile(session);
}

/**
 * Wire the API client so every login/refresh keeps the file in sync — the
 * client rotates the refresh token server-side, so a session restored after
 * an app kill must be the LATEST one, not the one from login time. Clearing
 * stays explicit (signOut / onAuthLost) so a transient null never wipes a
 * good session.
 */
export function bindSessionPersistence() {
  api.onSession = (s) => {
    if (!s) return;
    writeSessionFile(s).catch(() => {
      // best-effort: the in-memory session still works; next refresh retries
    });
  };
  api.onAuthLost = () => {
    void persistSession(null);
  };
}
