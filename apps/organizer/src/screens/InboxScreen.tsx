/**
 * F3 — one-way notification inbox, fed live from GET /api/notifications.
 * Organizers are read-only recipients; a head's broadcast lands here and over
 * Web Push. Newest first, an unread item is marked by a heavy left rule (not
 * a badge colour), and a message opens into a plain full-screen read view —
 * the single bottom action marks it read on the server and returns.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Action, Card, Eyebrow, ink, layout, Mono, Rule, Screen, type } from '@mianu/ui';
import { api } from '../lib/api';
import type { NotificationItem } from '@mianu/types';

/** Relative time for list rows; absolute time on the open message. */
function ago(iso: string): string {
  const t = Date.now() - new Date(iso).getTime();
  const m = Math.floor(t / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

export function InboxScreen() {
  const [notes, setNotes] = useState<NotificationItem[] | null>(null);
  const [open, setOpen] = useState<NotificationItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { notifications } = await api.notifications();
      setNotes(notifications);
      setError(null);
    } catch {
      setError('Inbox unavailable. Check the connection.');
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const unread = (notes ?? []).filter((n) => !n.readAt).length;

  const openNote = (n: NotificationItem) => {
    setOpen(n);
    if (!n.readAt) {
      // Optimistic read state; the server copy is the source of truth.
      setNotes((ns) => (ns ?? []).map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      api.markNotificationRead(n.id).catch(() => {});
    }
  };

  if (open) {
    return (
      <Screen
        scroll
        footer={<Action label="Mark read · Back to inbox" onPress={() => setOpen(null)} />}
      >
        <View style={styles.header}>
          <Text style={styles.stationLabel}>INBOX</Text>
          <Rule />
        </View>
        <View style={styles.body}>
          <Eyebrow>{open.from}</Eyebrow>
          <Text style={styles.title}>{open.title}</Text>
          <View style={styles.metaRow}>
            <Mono>{new Date(open.at).toLocaleString()}</Mono>
          </View>
          <Rule />
          <Text style={styles.bodyText}>{open.body}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.stationLabel}>INBOX</Text>
        <Rule />
      </View>
      <View style={styles.body}>
        {notes === null ? (
          <Text style={styles.count}>Loading…</Text>
        ) : (
          <Text style={styles.count}>
            {unread} unread <Text style={styles.countRest}>of {notes.length}</Text>
          </Text>
        )}
        {error ? <Text style={styles.itemAt}>{error}</Text> : null}
        {(notes ?? []).map((n, i) => {
          const read = n.readAt !== null;
          return (
            <Pressable
              key={n.id}
              onPress={() => openNote(n)}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              accessibilityRole="button"
              accessibilityLabel={n.title}
            >
              <View style={[styles.itemRule, read ? styles.itemRuleRead : null]} />
              <View style={styles.itemBody}>
                <Text style={styles.itemFrom}>{n.from}</Text>
                <Text style={[styles.itemTitle, read && styles.itemTitleRead]} numberOfLines={1}>
                  {n.title}
                </Text>
                <Text style={styles.itemPreview} numberOfLines={2}>
                  {n.body}
                </Text>
                <Text style={styles.itemAt}>{ago(n.at)}</Text>
              </View>
              {i < (notes?.length ?? 0) - 1 ? <Rule /> : null}
            </Pressable>
          );
        })}
        {notes && notes.length === 0 && !error ? (
          <Text style={styles.itemAt}>No notifications yet.</Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter, gap: 12 },
  body: { paddingHorizontal: layout.gutter, paddingTop: 18, paddingBottom: 12 },
  stationLabel: { ...type.label, fontSize: 15, color: ink.ink },
  count: { ...type.verdict, fontSize: 22, color: ink.ink, marginBottom: 18 },
  countRest: { ...type.body, fontSize: 15, color: ink.ash, fontWeight: '400' },
  item: { flexDirection: 'row' },
  itemPressed: { opacity: 0.6 },
  itemRule: { width: 3, backgroundColor: ink.ink, marginRight: 14 },
  itemRuleRead: { backgroundColor: ink.fog },
  itemBody: { flex: 1, paddingVertical: 14 },
  itemFrom: { ...type.label, fontSize: 11, color: ink.ash, marginBottom: 4 },
  itemTitle: { ...type.title, color: ink.ink },
  itemTitleRead: { fontWeight: '400', color: ink.ash },
  itemPreview: { ...type.body, fontSize: 14, color: ink.ash, marginTop: 4 },
  itemAt: { ...type.body, fontSize: 12, color: ink.ash, marginTop: 8 },
  title: { ...type.verdict, fontSize: 22, color: ink.ink, marginTop: 6 },
  metaRow: { flexDirection: 'row', marginTop: 6 },
  bodyText: { ...type.body, fontSize: 16, color: ink.ink, marginTop: 14, lineHeight: 24 },
});
