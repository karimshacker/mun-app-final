/**
 * Root of the organizer app.
 *
 * Navigation is deliberately flat: a bottom bar of at most four destinations.
 * Anyone working a door is one tap from scanning, and the bar itself is
 * monochrome with the active tab marked by a rule above it rather than a
 * colour fill.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ink, layout, Rule, type } from '@mianu/ui';
import { ScanScreen } from './screens/ScanScreen';
import { InboxScreen } from './screens/InboxScreen';
import { ChatScreen } from './screens/ChatScreen';
import { BoardScreen } from './screens/BoardScreen';
import type { Role } from '@mianu/types';

type Tab = 'scan' | 'inbox' | 'chat' | 'board';

const TABS: Array<{ id: Tab; label: string; roles: Role[] }> = [
  { id: 'scan', label: 'Scan', roles: ['HEAD', 'DEPUTY', 'ORGANIZER'] },
  { id: 'inbox', label: 'Inbox', roles: ['HEAD', 'DEPUTY', 'ORGANIZER'] },
  { id: 'chat', label: 'Comms', roles: ['HEAD', 'DEPUTY'] },
  { id: 'board', label: 'Board', roles: ['HEAD'] },
];

export function App({ role = 'ORGANIZER' }: { role?: Role }) {
  const [tab, setTab] = useState<Tab>('scan');
  const visible = TABS.filter((t) => t.roles.includes(role));
  const current = visible.find((t) => t.id === tab) ?? visible[0];

  return (
    <View style={styles.shell}>
      <View style={styles.stage}>
        {current.id === 'scan' && <ScanScreen stationType="CONFERENCE_IN" stationLabel="MAIN ENTRANCE · CHECK-IN" />}
        {current.id === 'inbox' && <InboxScreen />}
        {current.id === 'chat' && <ChatScreen />}
        {current.id === 'board' && <BoardScreen />}
      </View>
      <Rule />
      <View style={styles.tabs}>
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
  tabs: { flexDirection: 'row', paddingBottom: 8 },
  tab: { flex: 1, alignItems: 'center', paddingTop: 10, minHeight: layout.touch },
  tabMark: { width: 28, height: 3, backgroundColor: ink.ink, marginBottom: 6 },
  tabLabel: { ...type.body, fontSize: 14, fontWeight: '600', color: ink.ash },
  tabLabelActive: { color: ink.ink, fontWeight: '800' },
});
