/**
 * F3 — one-way notification inbox. Organizers are read-only recipients; a
 * head's broadcast lands here and over Web Push.
 *
 * UX decisions: newest first, an unread item is marked by a heavy left rule
 * (not a badge colour), and a message opens into a plain full-screen read
 * view so nobody panics about how to get back — the single bottom action.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Action, Card, Eyebrow, ink, layout, Mono, Rule, type } from '@mianu/ui';

interface Note {
  id: string;
  from: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
}

const SEED: Note[] = [
  {
    id: 'n1',
    from: 'HEAD · Y. Amrani',
    title: 'Opening ceremony moved',
    body: 'Doors open 08:30, not 09:00. Hold all committee check-ins until the secretary-general finishes. Halls stay closed.',
    at: '07:12',
    read: false,
  },
  {
    id: 'n2',
    from: 'HEAD · Y. Amrani',
    title: 'Water shortage in Hall 2',
    body: 'Hall 2 is out of water until 13:00. Send delegates to Hall 1 during the break. Do not buy with petty cash.',
    at: '09:41',
    read: false,
  },
  {
    id: 'n3',
    from: 'IT ADMIN',
    title: 'Badge batch B is live',
    body: 'Badges B001–B240 are linked. Any badge from batch A that fails to scan twice — use the printed code.',
    at: 'Yesterday',
    read: true,
  },
];

export function InboxScreen() {
  const [notes, setNotes] = useState(SEED);
  const [open, setOpen] = useState<Note | null>(null);
  const unread = notes.filter((n) => !n.read).length;

  if (open) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.stationLabel}>INBOX</Text>
          <Rule />
        </View>
        <View style={styles.body}>
          <Eyebrow>{open.from}</Eyebrow>
          <Text style={styles.title}>{open.title}</Text>
          <View style={styles.metaRow}>
            <Mono>{open.at}</Mono>
          </View>
          <Rule />
          <Text style={styles.body}>{open.body}</Text>
        </View>
        <View style={styles.footer}>
          <Action
            label="Mark read · Back to inbox"
            onPress={() => {
              setNotes((ns) => ns.map((n) => (n.id === open.id ? { ...n, read: true } : n)));
              setOpen(null);
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.stationLabel}>INBOX</Text>
        <Rule />
      </View>
      <View style={styles.body}>
        <Text style={styles.count}>
          {unread} unread <Text style={styles.countRest}>of {notes.length}</Text>
        </Text>
        {notes.map((n, i) => (
          <Pressable
            key={n.id}
            onPress={() => setOpen(n)}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            accessibilityRole="button"
            accessibilityLabel={n.title}
          >
            <View style={[styles.itemRule, n.read ? styles.itemRuleRead : null]} />
            <View style={styles.itemBody}>
              <Text style={styles.itemFrom}>{n.from}</Text>
              <Text style={[styles.itemTitle, n.read && styles.itemTitleRead]} numberOfLines={1}>
                {n.title}
              </Text>
              <Text style={styles.itemPreview} numberOfLines={2}>
                {n.body}
              </Text>
              <Text style={styles.itemAt}>{n.at}</Text>
            </View>
            {i < notes.length - 1 ? <Rule /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ink.paper },
  header: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter, gap: 12 },
  body: { flex: 1, paddingHorizontal: layout.gutter, paddingTop: 18 },
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
  footer: { paddingHorizontal: layout.gutter, paddingBottom: 20 },
});
