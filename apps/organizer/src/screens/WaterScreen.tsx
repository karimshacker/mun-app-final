/**
 * The staff side of the water loop. Venue systems POST to the public worker
 * (no auth, closed network); every order lands in D1 and — via the public
 * worker's fan-out — in every inbox. This screen is the operations view:
 * newest orders first, open ones on top, and HEAD/DEPUTY can walk an order
 * RECEIVED → ACKNOWLEDGED → DELIVERED (or CANCELLED). Organizers get the
 * same list read-only, so a hall volunteer sees their own request moving.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Action, Card, ink, layout, Mono, Rule, Screen, type } from '@mianu/ui';
import { api } from '../lib/api';
import type { WaterOrder } from '@mianu/types';

function ago(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
}

export function WaterScreen({ canManage }: { canManage: boolean }) {
  const [orders, setOrders] = useState<WaterOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyRef, setBusyRef] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { orders: rows } = await api.waterOrders();
      setOrders(rows);
      setError(null);
    } catch {
      setError('Water orders unavailable. Check the connection.');
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const move = async (ref: string, status: 'ACKNOWLEDGED' | 'DELIVERED' | 'CANCELLED') => {
    setBusyRef(ref);
    try {
      await api.setWaterStatus(ref, status);
      // Optimistic flip; the next poll is the source of truth.
      setOrders((os) => (os ?? []).map((o) => (o.ref === ref ? { ...o, status } : o)));
      setError(null);
    } catch (e: any) {
      // A 409 means another operator already moved this order — refresh
      // instead of arguing with the server.
      await load();
      setError(
        e?.code === 'invalid_transition'
          ? 'That order already moved on — list refreshed.'
          : 'Could not update the order. Check the connection.',
      );
    } finally {
      setBusyRef(null);
    }
  };

  const open = useMemo(
    () => (orders ?? []).filter((o) => o.status === 'RECEIVED' || o.status === 'ACKNOWLEDGED'),
    [orders],
  );

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.label}>WATER RUNS</Text>
        <Text style={styles.count}>
          {orders ? `${open.length} open · ${orders.length} recent` : 'Loading…'}
        </Text>
        <Rule />
      </View>
      <View style={styles.body}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {(orders ?? []).map((o) => (
          <Card key={o.ref} style={styles.card}>
            <View style={styles.topRow}>
              <Text style={styles.committee}>{(o.committeeName ?? o.committeeId).toUpperCase()}</Text>
              <Text style={styles.status}>{o.status}</Text>
            </View>
            <Text style={styles.quantity}>
              {o.quantity} <Text style={styles.unit}>UNITS</Text>
            </Text>
            <View style={styles.metaRow}>
              <Mono>{o.ref}</Mono>
              <Text style={styles.meta}>· {ago(o.createdAt)}</Text>
              {o.requesterSystem ? <Text style={styles.meta}>· {o.requesterSystem}</Text> : null}
            </View>
            {o.note ? <Text style={styles.note}>{o.note}</Text> : null}
            {canManage && o.status !== 'DELIVERED' && o.status !== 'CANCELLED' ? (
              <View style={styles.actions}>
                {o.status === 'RECEIVED' ? (
                  <Action
                    label={busyRef === o.ref ? '…' : 'ACKNOWLEDGE'}
                    disabled={busyRef === o.ref}
                    onPress={() => move(o.ref, 'ACKNOWLEDGED')}
                  />
                ) : (
                  <Action
                    label={busyRef === o.ref ? '…' : 'MARK DELIVERED'}
                    disabled={busyRef === o.ref}
                    onPress={() => move(o.ref, 'DELIVERED')}
                  />
                )}
                <Action
                  label="Cancel"
                  disabled={busyRef === o.ref}
                  onPress={() => move(o.ref, 'CANCELLED')}
                  testID={`cancel-${o.ref}`}
                />
              </View>
            ) : null}
          </Card>
        ))}
        {orders && orders.length === 0 && !error ? (
          <Text style={styles.meta}>No water orders yet. They appear the moment a system orders.</Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter, gap: 12 },
  body: { paddingHorizontal: layout.gutter, paddingTop: 18, paddingBottom: 12 },
  label: { ...type.label, fontSize: 15, color: ink.ink },
  count: { ...type.verdict, fontSize: 18, color: ink.ink },
  card: { marginBottom: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  committee: { ...type.label, fontSize: 13, color: ink.ink, fontWeight: '800' },
  status: { ...type.label, fontSize: 11, color: ink.ash },
  quantity: { ...type.verdict, fontSize: 30, color: ink.ink, marginTop: 6 },
  unit: { fontSize: 14, fontWeight: '600', color: ink.ash, letterSpacing: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  meta: { ...type.body, fontSize: 12, color: ink.ash },
  note: { ...type.body, fontSize: 14, color: ink.ink, marginTop: 8 },
  actions: { marginTop: 14, gap: 10 },
  error: { ...type.body, fontSize: 12, color: ink.ink, fontWeight: '600', marginBottom: 10 },
});
