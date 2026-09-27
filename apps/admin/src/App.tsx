/**
 * Root of the IT admin app. Two jobs, two tabs: bind badges, manage money.
 * The tab bar mirrors the organizer app's so an admin switching between the
 * two apps on the same phone finds the controls in the same place. Sessions
 * persist across app kills exactly like the organizer app's.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ink, layout, Rule, type } from '@mianu/ui';
import type { AuthSession } from '@mianu/types';
import { bindSessionPersistence, restoreSession } from './lib/session';
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
    restoreSession()
      .then(setSession)
      .finally(() => setBooted(true));
  }, []);

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
    <AppTabs session={session} tab={tab} setTab={setTab} />
    </SafeAreaProvider>
  );
}

function AppTabs({
  session,
  tab,
  setTab,
}: {
  session: AuthSession;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.shell}>
      <View style={styles.stage}>
        {tab === 'badges' ? <LinkBadgeScreen /> : <TopUpScreen />}
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
  tabs: { flexDirection: 'row', paddingBottom: 8 },
  tab: { flex: 1, alignItems: 'center', paddingTop: 10, minHeight: layout.touch },
  tabMark: { width: 28, height: 3, backgroundColor: ink.ink, marginBottom: 6 },
  tabLabel: { ...type.body, fontSize: 14, fontWeight: '600', color: ink.ash },
  tabLabelActive: { color: ink.ink, fontWeight: '800' },
});
