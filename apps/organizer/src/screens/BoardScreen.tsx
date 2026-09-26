/**
 * F4 — the head's presence board. Hybrid positioning: GPS outdoors, hall
 * resolution from NFC scans indoors. A head does not need a map to act; a
 * sorted list of organizers with their current resolution is faster to triage
 * at a glance, so that is the primary surface and the map is secondary.
 *
 * Position is derived, never precise indoors: we show "IN HALL 3" or
 * "MOVING · GPS", never coordinates. Privacy is the default — there is a
 * per-organizer BREAK toggle and positions TTL after the conference.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Eyebrow, ink, layout, Mono, Rule, type } from '@mianu/ui';

interface OrganizerPos {
  id: string;
  name: string;
  committee: string;
  res: string;
  source: 'GPS' | 'HALL_SCAN';
  at: string;
  onBreak: boolean;
}

const SEED: OrganizerPos[] = [
  { id: 'o1', name: 'S. Benali', committee: 'GA', res: 'IN HALL 3', source: 'HALL_SCAN', at: '2 min ago', onBreak: false },
  { id: 'o2', name: 'M. Haddad', committee: 'SOCHUM', res: 'MOVING · GPS', source: 'GPS', at: '6 min ago', onBreak: false },
  { id: 'o3', name: 'L. Cherif', committee: 'HRC', res: 'IN HALL 1', source: 'HALL_SCAN', at: '11 min ago', onBreak: false },
  { id: 'o4', name: 'A. Zeroual', committee: 'SC', res: 'BREAK', source: 'GPS', at: '24 min ago', onBreak: true },
  { id: 'o5', name: 'R. Bouzid', committee: 'UNSC', res: 'OFF DUTY', source: 'GPS', at: '2 h ago', onBreak: false },
];

export function BoardScreen() {
  const [people] = useState(SEED);
  const [filter, setFilter] = useState<string | null>(null);
  const committees = [...new Set(people.map((p) => p.committee))];
  const shown = filter ? people.filter((p) => p.committee === filter) : people;
  const active = people.filter((p) => !p.onBreak && p.res !== 'OFF DUTY').length;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.stationLabel}>PRESENCE BOARD</Text>
        <Rule />
      </View>
      <View style={styles.body}>
        <Text style={styles.count}>
          {active} on duty <Text style={styles.countRest}>of {people.length}</Text>
        </Text>

        <View style={styles.filters}>
          <Chip label="All" active={filter === null} onPress={() => setFilter(null)} />
          {committees.map((c) => (
            <Chip key={c} label={c} active={filter === c} onPress={() => setFilter(c)} />
          ))}
        </View>

        {shown.map((p) => (
          <Card key={p.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.name} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={styles.committee}>{p.committee}</Text>
            </View>
            <View style={styles.resRow}>
              <View style={styles.resMark} />
              <Text style={styles.res}>{p.res}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{p.source === 'GPS' ? 'GPS' : 'HALL SCAN'}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.meta}>{p.at}</Text>
              {p.onBreak ? (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaBold}>ON BREAK</Text>
                </>
              ) : null}
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ink.paper },
  header: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter, gap: 12 },
  body: { flex: 1, paddingHorizontal: layout.gutter, paddingTop: 18 },
  stationLabel: { ...type.label, fontSize: 15, color: ink.ink },
  count: { ...type.verdict, fontSize: 22, color: ink.ink, marginBottom: 16 },
  countRest: { ...type.body, fontSize: 15, color: ink.ash, fontWeight: '400' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: { borderWidth: 1, borderColor: ink.rule, paddingHorizontal: 12, paddingVertical: 7 },
  chipActive: { backgroundColor: ink.ink },
  chipText: { ...type.label, fontSize: 11, color: ink.ink },
  chipTextActive: { color: ink.inverse },
  card: { marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  name: { ...type.name, color: ink.ink, flexShrink: 1 },
  committee: { ...type.label, fontSize: 11, color: ink.ash },
  resRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  resMark: { width: 10, height: 10, borderWidth: 1, borderColor: ink.ink, backgroundColor: ink.paper },
  res: { ...type.label, fontSize: 13, color: ink.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  meta: { ...type.body, fontSize: 12, color: ink.ash },
  metaBold: { ...type.body, fontSize: 12, color: ink.ink, fontWeight: '800' },
  metaDot: { ...type.body, fontSize: 12, color: ink.fog },
});
