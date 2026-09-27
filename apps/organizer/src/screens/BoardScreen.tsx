/**
 * F4 — the head's dashboard, live from GET /api/board (organizer locations)
 * and GET /api/presence (participant hall occupancy). Position is derived,
 * never precise indoors: we show "IN HALL 3" or "MOVING · GPS", never
 * coordinates. Each organizer can go invisible with the BREAK toggle.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, ink, layout, Screen, type } from '@mianu/ui';
import { api } from '../lib/api';
import type { BoardRow, PresenceRow } from '@mianu/types';

function ago(iso: string | null): string {
  if (!iso) return '—';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
}

/** Human resolution line for one organizer row. */
function resOf(p: BoardRow): string {
  if (p.onBreak) return 'BREAK';
  if (p.lastStation === 'HALL_IN' && p.lastHall) return `IN ${p.lastHall.toUpperCase()}`;
  if (p.lat != null && p.lng != null) return 'MOVING · GPS';
  if (p.lastStation === 'MEAL') return 'AT A MEAL STATION';
  if (p.lastStation === 'HALL_OUT') return 'BETWEEN HALLS';
  return 'OFF DUTY';
}

export function BoardScreen() {
  const [people, setPeople] = useState<BoardRow[] | null>(null);
  const [presence, setPresence] = useState<PresenceRow[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, pr] = await Promise.all([api.board(), api.presence()]);
      setPeople(b.rows);
      setPresence(pr.rows);
      setError(null);
    } catch {
      setError('Board unavailable. Check the connection.');
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const committees = useMemo(
    () => [...new Set((people ?? []).map((p) => p.committeeId).filter((c): c is string => !!c))],
    [people],
  );
  const shown = (people ?? []).filter((p) => !filter || p.committeeId === filter);
  const active = (people ?? []).filter((p) => !p.onBreak && resOf(p) !== 'OFF DUTY').length;
  const inBuilding = presence.length;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.stationLabel}>PRESENCE BOARD</Text>
        <Text style={styles.count}>
          {people ? `${active} on duty · ${inBuilding} delegates in` : 'Loading…'}
        </Text>
        <View style={styles.filters}>
          <Chip label="All" active={filter === null} onPress={() => setFilter(null)} />
          {committees.map((c) => (
            <Chip key={c} label={c} active={filter === c} onPress={() => setFilter(c)} />
          ))}
        </View>
      </View>
      <View style={styles.body}>
        {error ? <Text style={styles.meta}>{error}</Text> : null}
        {shown.map((p) => {
          const res = resOf(p);
          const onDuty = !p.onBreak && res !== 'OFF DUTY';
          return (
            <Card key={p.userId} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.name} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.committee}>{p.committeeId ?? '—'}</Text>
              </View>
              <View style={styles.resRow}>
                <View style={[styles.resMark, onDuty && styles.resMarkOn]} />
                <Text style={styles.res}>{res}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>{p.source === 'GPS' ? 'GPS' : p.lastStation ? 'HALL SCAN' : 'NO SIGNAL'}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.meta}>{ago(p.at)}</Text>
                {p.onBreak ? (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaBold}>ON BREAK</Text>
                  </>
                ) : null}
              </View>
            </Card>
          );
        })}
        {people && people.length === 0 && !error ? (
          <Text style={styles.meta}>No organizers on the roster yet.</Text>
        ) : null}
      </View>
    </Screen>
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
  header: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter, gap: 12 },
  body: { paddingHorizontal: layout.gutter, paddingTop: 18, paddingBottom: 12 },
  stationLabel: { ...type.label, fontSize: 15, color: ink.ink },
  count: { ...type.verdict, fontSize: 18, color: ink.ink },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
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
  resMarkOn: { backgroundColor: ink.ink },
  res: { ...type.label, fontSize: 13, color: ink.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  meta: { ...type.body, fontSize: 12, color: ink.ash },
  metaBold: { ...type.body, fontSize: 12, color: ink.ink, fontWeight: '800' },
  metaDot: { ...type.body, fontSize: 12, color: ink.fog },
});
