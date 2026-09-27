/**
 * Root of the IT admin app. Two jobs, two tabs: bind badges, manage money.
 * The tab bar mirrors the organizer app's so an admin switching between the
 * two apps on the same phone finds the controls in the same place. Sessions
 * persist across app kills; the strip above the tab bar shows who is signed
 * in and hands the phone to the next operator.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GhostLink, ink, layout, Rule, type } from '@mianu/ui';
import type { AuthSession } from '@mianu/types';
import { api } from './lib/api';
import { bindSessionPersistence, persistSession, restoreSession } from './lib/session';
import { LoginScreen } from './screens/LoginScreen';
import { LinkBadgeScreen } from './screens/LinkBadgeScreen';
import { TopUpScreen } from './screens/TopUpScreen';

type Tab = 'badges' | 'balance';

export function App() {
  const [booted, setBooted] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [tab, setTab] = useState<Tab>('badges');

  useEffect(() => {
    bindSessionPersistence();
    // Chain onto the persistence handler: expired sessions must BOTH clear
    // the stored file and return the app to the login screen.
    const chained = api.onAuthLost;
    api.onAuthLost = () => {
      chained?.();
      setSession(null);
    };
    restoreSession()
      .then(setSession)
      .finally(() => setBooted(true));
  }, []);

  // Plain function, not a hook: it lives after the early returns, so a
  // useCallback here would change hook order between renders and crash.
  const signOut = async () => {
    await api.signOut();
    // Also delete the stored copy so the next launch starts at login.
    await persistSession(null);
    setSession(null);
    setTab('badges');
  };

  if (!booted) {
    return <SafeAreaProvider><View style={styles.shell} /></SafeAreaProvider>;
  }

  if (!session) {
    return (
      <SafeAreaProvider>
        <LoginScreen
          onSignedIn={(s) => {
            setSession(s);
            setTab('badges');
          }}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppTabs session={session} tab={tab} setTab={setTab} onSignOut={signOut} />
    </SafeAreaProvider>
  );
}

function AppTabs({
  session,
  tab,
  setTab,
  onSignOut,
}: {
  session: AuthSession;
  tab: Tab;
  setTab: (t: Tab) => void;
  onSignOut: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.shell}>
      <View style={styles.stage}>
        {tab === 'badges' ? <LinkBadgeScreen /> : <TopUpScreen />}
      </View>
      <View style={styles.accountRow}>
        <Text style={styles.accountName} numberOfLines={1}>
          {session.user.name} · {session.user.role}
        </Text>
        <GhostLink label="Sign out" onPress={onSignOut} />
      </View>
      <Rule />
      <View style={[styles.tabs, { paddingBottom: 8 + insets.bottom }]}>
        <TabButton label="Badges" active={tab === 'badges'} onPress={() => setTab('badges')} />
        <TabButton label="Balance" active={tab === 'balance'} onPress={() => setTab('balance')} />
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
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
    paddingTop: 8,
    gap: 12,
  },
  accountName: { ...type.label, fontSize: 11, color: ink.ash, flexShrink: 1 },
  tabs: { flexDirection: 'row', paddingBottom: 8 },
  tab: { flex: 1, alignItems: 'center', paddingTop: 10, minHeight: layout.touch },
  tabMark: { width: 28, height: 3, backgroundColor: ink.ink, marginBottom: 6 },
  tabLabel: { ...type.body, fontSize: 14, fontWeight: '600', color: ink.ash },
  tabLabelActive: { color: ink.ink, fontWeight: '800' },
});
