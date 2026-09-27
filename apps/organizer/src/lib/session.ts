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
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(session));
}

/** Wire the API client so every login/refresh/logout keeps the file in sync. */
export function bindSessionPersistence() {
  api.onSession = (s) => {
    if (!s) return; // saves are explicit; avoids write-on-every-refresh races
  };
  api.onAuthLost = () => {
    persistSession(null);
  };
}
