/**
 * F3 — the composing side of the notification stream. HEAD and DEPUTY write
 * a broadcast here; the server fans it out to every recipient's inbox (and
 * Web Push). Audience is ALL staff or one committee's organizers — the
 * picker lists the live committees, one per hall. After sending, the receipt
 * confirms what went out and to whom; there is no recall, so the confirm
 * step asks for one deliberate press before the wire.
 */
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Action, Card, Eyebrow, ink, layout, Mono, Rule, Screen, type } from '@mianu/ui';
import { api } from '../lib/api';
import type { CommitteeInfo, NotificationItem } from '@mianu/types';

export function BroadcastScreen() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<string>('ALL');
  const [committees, setCommittees] = useState<CommitteeInfo[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState<NotificationItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .committees()
      .then(({ committees: cs }) => setCommittees(cs))
      .catch(() => setCommittees([])); // offline: ALL still works, per-committee shows a retry hint
  }, []);

  const send = async () => {
    setBusy(true);
    try {
      const { notification } = await api.sendNotification({ title: title.trim(), body: body.trim(), audience });
      setSent(notification);
      setTitle('');
      setBody('');
      setAudience('ALL');
      setConfirming(false);
      setError(null);
    } catch (e: any) {
      setError(
        e?.code === 'unknown_audience'
          ? 'That committee no longer exists — pick the audience again.'
          : 'Not sent. Check the connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Screen scroll>
        <View style={styles.header}>
          <Text style={styles.label}>BROADCAST · SENT</Text>
          <Rule />
        </View>
        <View style={styles.body}>
          <Card>
            <Eyebrow>To {sent.audience === 'ALL' ? 'all staff' : sent.audience}</Eyebrow>
            <Text style={styles.sentTitle}>{sent.title}</Text>
            <Mono>{new Date(sent.at).toLocaleTimeString()}</Mono>
          </Card>
          <View style={styles.stack}>
            <Action label="Compose another" onPress={() => setSent(null)} testID="compose-again" />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        scroll
        footer={
          <View style={styles.footer}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {confirming ? (
              <Action
                label={busy ? 'Sending…' : `SEND NOW · ${audience === 'ALL' ? 'ALL STAFF' : audience}`}
                disabled={busy}
                onPress={send}
                testID="confirm-send"
              />
            ) : (
              <Action
                label="Review before sending"
                disabled={title.trim().length === 0 || body.trim().length === 0}
                onPress={() => setConfirming(true)}
                testID="review-broadcast"
              />
            )}
          </View>
        }
      >
        <View style={styles.header}>
          <Text style={styles.label}>BROADCAST</Text>
          <Rule />
        </View>
        <View style={styles.body}>
          <Card>
            <Eyebrow>Audience</Eyebrow>
            <View style={styles.audiences}>
              <AudienceChip label="ALL STAFF" active={audience === 'ALL'} onPress={() => setAudience('ALL')} />
              {committees.map((c) => (
                <AudienceChip
                  key={c.id}
                  label={c.id.toUpperCase()}
                  active={audience === c.id}
                  onPress={() => setAudience(c.id)}
                />
              ))}
            </View>
          </Card>

          <Card>
            <Eyebrow>Title</Eyebrow>
            <TextInput
              style={styles.input}
              placeholder="Hall 3 session moved"
              placeholderTextColor={ink.ash}
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              returnKeyType="next"
            />
            <Rule />
            <Eyebrow>Message</Eyebrow>
            <TextInput
              style={[styles.input, styles.bodyInput]}
              placeholder="Starts 14:00 instead of 13:00…"
              placeholderTextColor={ink.ash}
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={2000}
            />
          </Card>

          {confirming ? (
            <Card>
              <Eyebrow>Preview — press SEND NOW to wire it</Eyebrow>
              <Text style={styles.sentTitle}>{title}</Text>
              <Text style={styles.previewBody}>{body}</Text>
              <View style={styles.rowCenter}>
                <Action label="Edit instead" onPress={() => setConfirming(false)} invert testID="edit-broadcast" />
              </View>
            </Card>
          ) : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function AudienceChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: ink.paper },
  header: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter, gap: 12 },
  body: { paddingHorizontal: layout.gutter, paddingTop: 18, paddingBottom: 12, gap: 14 },
  label: { ...type.label, fontSize: 15, color: ink.ink },
  footer: { paddingHorizontal: layout.gutter, paddingBottom: 12, gap: 8 },
  audiences: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: ink.rule,
    paddingHorizontal: 12,
    paddingVertical: 7,
    ...type.label,
    fontSize: 11,
    color: ink.ink,
    overflow: 'hidden',
  },
  chipActive: { backgroundColor: ink.ink, color: ink.inverse },
  input: {
    borderWidth: layout.hair,
    borderColor: ink.rule,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...type.body,
    fontSize: 16,
    color: ink.ink,
    marginTop: 8,
    marginBottom: 12,
  },
  bodyInput: { minHeight: 110, textAlignVertical: 'top' },
  sentTitle: { ...type.title, color: ink.ink, marginVertical: 8 },
  previewBody: { ...type.body, fontSize: 15, color: ink.ash, marginBottom: 12 },
  stack: { marginTop: 4, gap: 12 },
  rowCenter: { alignItems: 'center', marginTop: 12 },
  error: { ...type.body, fontSize: 12, color: ink.ink, fontWeight: '600', textAlign: 'center' },
});
