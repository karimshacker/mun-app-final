/**
 * Session persistence for the IT admin app. Same contract as the organizer
 * app's module: refresh token in the private documents directory, restored
 * before first render, cleared on sign-out or auth loss.
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
    return null;
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

export function bindSessionPersistence() {
  api.onSession = (s) => {
    if (!s) return;
  };
  api.onAuthLost = () => {
    persistSession(null);
  };
}
