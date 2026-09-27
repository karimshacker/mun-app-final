/**
 * F3 — two-way head ↔ deputy comms, live from GET/POST /api/chat. The client
 * polls with a `since` cursor every few seconds, which is cheap and works
 * everywhere; Durable-Object WebSockets can replace the transport later
 * without touching this screen's contract. No bubbles, no colours: outgoing
 * messages sit flush right behind a rule, incoming sit left.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Action, ink, layout, Rule, type } from '@mianu/ui';
import { api } from '../lib/api';
import type { ChatMessage } from '@mianu/types';

export function ChatScreen({ myUserId }: { myUserId: string }) {
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const lastAt = useRef<string | null>(null);

  const load = useCallback(async (initial = false) => {
    try {
      const { messages } = await api.chatMessages(initial ? undefined : (lastAt.current ?? undefined));
      if (messages.length) {
        lastAt.current = messages[messages.length - 1].at;
        setMsgs((prev) => (initial ? messages : mergeById(prev, messages)));
      } else if (initial) {
        setMsgs([]);
      }
      setError(null);
    } catch {
      setError('Connection lost — retrying…');
    }
  }, []);

  useEffect(() => {
    load(true);
    const id = setInterval(() => load(false), 4000);
    return () => clearInterval(id);
  }, [load]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    try {
      const { message } = await api.sendChatMessage(text);
      lastAt.current = message.at;
      setMsgs((m) => mergeById(m, [message]));
      setError(null);
    } catch {
      setDraft(text); // put the words back; the operator can retry
      setError('Not sent. Check the connection and send again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 8) }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.stationLabel}>HEAD ↔ DEPUTY</Text>
        <Rule />
      </View>
      <ScrollView
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        keyboardDismissMode="on-drag"
      >
        {msgs.map((m, i) => {
          const mine = m.senderId === myUserId;
          const prevMine = msgs[i - 1]?.senderId === m.senderId;
          return (
            <View
              key={m.id}
              style={[styles.row, mine ? styles.rowMine : styles.rowTheirs, prevMine && styles.rowTight]}
            >
              {!mine && !prevMine ? <Text style={styles.who}>{m.senderName}</Text> : null}
              <View style={[styles.msg, mine ? styles.msgMine : styles.msgTheirs]}>
                <Text style={[styles.msgText, mine ? styles.msgTextMine : styles.msgTextTheirs]}>
                  {m.body}
                </Text>
              </View>
              <Text style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}>{hm(m.at)}</Text>
            </View>
          );
        })}
        {msgs.length === 0 && !error ? (
          <Text style={styles.time}>No messages yet. Say something.</Text>
        ) : null}
      </ScrollView>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Rule />
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Message the head…"
          placeholderTextColor={ink.ash}
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={2000}
        />
        <Action label="Send" disabled={!draft.trim()} onPress={send} testID="send" />
      </View>
    </KeyboardAvoidingView>
  );
}

function mergeById(prev: ChatMessage[], next: ChatMessage[]): ChatMessage[] {
  const seen = new Set(prev.map((m) => m.id));
  return [...prev, ...next.filter((m) => !seen.has(m.id))].sort((a, b) => a.at.localeCompare(b.at));
}

function hm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ink.paper },
  header: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter, gap: 12 },
  stationLabel: { ...type.label, fontSize: 15, color: ink.ink },
  thread: { flex: 1 },
  threadContent: { paddingHorizontal: layout.gutter, paddingVertical: 16, gap: 12 },
  row: { maxWidth: '82%' },
  rowMine: { alignSelf: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start' },
  rowTight: { marginTop: -4 },
  who: { ...type.label, fontSize: 11, color: ink.ash, marginLeft: 2, marginBottom: 4 },
  msg: { borderWidth: 1, borderColor: ink.rule, padding: 10 },
  msgMine: { backgroundColor: ink.ink },
  msgTheirs: { backgroundColor: ink.paper },
  msgText: { ...type.body, fontSize: 15 },
  msgTextMine: { color: ink.inverse },
  msgTextTheirs: { color: ink.ink },
  time: { ...type.body, fontSize: 11, color: ink.ash, marginTop: 4 },
  timeMine: { textAlign: 'right' },
  timeTheirs: { textAlign: 'left' },
  error: { ...type.body, fontSize: 12, color: ink.ink, textAlign: 'center', paddingBottom: 6 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: layout.gutter,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: ink.rule,
    borderRadius: 4,
    padding: 12,
    minHeight: 48,
    maxHeight: 120,
    ...type.body,
    fontSize: 15,
    color: ink.ink,
  },
});
