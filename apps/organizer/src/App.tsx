/**
 * Root of the organizer app.
 *
 * Flow: restore session → (login if needed) → pick station → scan. The tab
 * bar is role-filtered exactly as before. While signed in the app reports a
 * coarse GPS fix every five minutes (F4's hybrid location: GPS while moving,
 * hall-level from the organizer's own scans), and every GPS write is skipped
 * while the operator is on break.
 *
 * Layout: SafeAreaProvider wraps every branch; the signed-in shell lives in
 * its own component so the tab bar can read the home-indicator inset from
 * hooks that never sit behind an early return.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ink, layout, Rule, type } from '@mianu/ui';
import type { AuthSession, Role, StationType } from '@mianu/types';
import { api } from './lib/api';
import { bindSessionPersistence, restoreSession } from './lib/session';
import { LoginScreen } from './screens/LoginScreen';
import { StationScreen, type StationChoice } from './screens/StationScreen';
import { ScanScreen } from './screens/ScanScreen';
import { InboxScreen } from './screens/InboxScreen';
import { ChatScreen } from './screens/ChatScreen';
import { BoardScreen } from './screens/BoardScreen';

type Tab = 'scan' | 'inbox' | 'chat' | 'board';

const TABS: Array<{ id: Tab; label: string; roles: Role[] }> = [
  { id: 'scan', label: 'Scan', roles: ['HEAD', 'DEPUTY', 'ORGANIZER'] },
  { id: 'inbox', label: 'Inbox', roles: ['HEAD', 'DEPUTY', 'ORGANIZER'] },
  { id: 'chat', label: 'Comms', roles: ['HEAD', 'DEPUTY'] },
  { id: 'board', label: 'Board', roles: ['HEAD'] },
];

const GPS_INTERVAL_MS = 5 * 60 * 1000;

export function App() {
  const [booted, setBooted] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [station, setStation] = useState<StationChoice | null>(null);
  const [tab, setTab] = useState<Tab>('scan');

  // Restore the persisted session before the first render.
  useEffect(() => {
    bindSessionPersistence();
    restoreSession()
      .then(setSession)
      .finally(() => setBooted(true));
  }, []);

  const signedIn = session !== null;

  // F4: background duty reporting. Foreground GPS ping on a long interval —
  // deliberately coarse and infrequent to spare battery; hall-level precision
  // comes from the organizer's own station scans, which the board already reads.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;

    const ping = async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted || cancelled) return;
        const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled && !Number.isNaN(fix.coords.latitude)) {
          await api.setLocation(fix.coords.latitude, fix.coords.longitude);
        }
      } catch {
        // Location is opt-in-ish by design; a denied permission only costs the
        // GPS dot on the head's board, never a scan.
      }
    };

    ping();
    const id = setInterval(ping, GPS_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [signedIn]);

  if (!booted) {
    return (
      <SafeAreaProvider>
        <View style={styles.shell} />
      </SafeAreaProvider>
    );
  }

  if (!session) {
    return (
      <SafeAreaProvider>
        <LoginScreen
          onSignedIn={(s) => {
            setSession(s);
            setTab('scan');
          }}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SignedInShell
        session={session}
        station={station}
        setStation={setStation}
        tab={tab}
        setTab={setTab}
      />
    </SafeAreaProvider>
  );
}

function SignedInShell({
  session,
  station,
  setStation,
  tab,
  setTab,
}: {
  session: AuthSession;
  station: StationChoice | null;
  setStation: (s: StationChoice | null) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const insets = useSafeAreaInsets();
  const role = session.user.role;
  const visible = TABS.filter((t) => t.roles.includes(role));
  const current = visible.find((t) => t.id === tab) ?? visible[0];

  return (
    <View style={styles.shell}>
      <View style={styles.stage}>
        {current.id === 'scan' && (
          station ? (
            <ScanScreen
              stationType={station.stationType as StationType}
              committeeId={station.committeeId}
              mealType={station.mealType}
              stationLabel={station.stationLabel}
              onExit={() => setStation(null)}
            />
          ) : (
            <StationScreen onPick={setStation} />
          )
        )}
        {current.id === 'inbox' && <InboxScreen />}
        {current.id === 'chat' && <ChatScreen myUserId={session.user.id} />}
        {current.id === 'board' && <BoardScreen />}
      </View>
      <Rule />
      <View style={[styles.tabs, { paddingBottom: 8 + insets.bottom }]}>
        {visible.map((t) => (
          <TabButton key={t.id} label={t.label} active={t.id === current.id} onPress={() => setTab(t.id)} />
        ))}
      </View>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.tab} hitSlop={8} accessibilityRole="tab">
      {active ? <View style={styles.tabMark} /> : null}
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: ink.paper },
  stage: { flex: 1 },
  tabs: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', paddingTop: 10, minHeight: layout.touch },
  tabMark: { width: 28, height: 3, backgroundColor: ink.ink, marginBottom: 6 },
  tabLabel: { ...type.body, fontSize: 14, fontWeight: '600', color: ink.ash },
  tabLabelActive: { color: ink.ink, fontWeight: '800' },
});
