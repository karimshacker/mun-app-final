/**
 * Root of the IT admin app. Two jobs, two tabs: bind badges, manage money.
 * The tab bar mirrors the organizer app's so an admin switching between the
 * two apps on the same phone finds the controls in the same place.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ink, layout, Rule, type } from '@mianu/ui';
import { LinkBadgeScreen } from './screens/LinkBadgeScreen';
import { TopUpScreen } from './screens/TopUpScreen';

type Tab = 'badges' | 'balance';

export function App() {
  const [tab, setTab] = useState<Tab>('badges');
  return (
    <View style={styles.shell}>
      <View style={styles.stage}>
        {tab === 'badges' ? <LinkBadgeScreen /> : <TopUpScreen />}
      </View>
      <Rule />
      <View style={styles.tabs}>
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
