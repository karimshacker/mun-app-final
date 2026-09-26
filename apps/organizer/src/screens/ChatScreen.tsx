/**
 * F3 — two-way head ↔ deputy comms. Organizers do not get this tab.
 *
 * Kept deliberately quieter than a consumer chat app: no bubbles, no colours,
 * no read-receipt ticks. Outgoing messages sit flush right behind a rule,
 * incoming sit left. The composer is pinned above the keyboard area with a
 * single full-width send action so it is hittable while standing.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Action, ink, layout, Rule, type } from '@mianu/ui';

interface Msg {
  id: string;
  from: 'me' | string;
  text: string;
  at: string;
}

const SEED: Msg[] = [
  { id: 'm1', from: 'Y. Amrani', text: 'Report to Hall 3, the delegate queue is backing up.', at: '09:12' },
  { id: 'm2', from: 'me', text: 'On my way. Need a second scanner at the door?', at: '09:13' },
  { id: 'm3', from: 'Y. Amrani', text: 'Yes. Bring the spare battery too.', at: '09:14' },
];

export function ChatScreen() {
  const [msgs, setMsgs] = useState(SEED);
  const [draft, setDraft] = useState('');

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMsgs((m) => [...m, { id: `m${Date.now()}`, from: 'me', text, at: nowHM() }]);
    setDraft('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.stationLabel}>HEAD ↔ DEPUTY</Text>
        <Rule />
      </View>
      <View style={styles.thread}>
        {msgs.map((m, i) => {
          const mine = m.from === 'me';
          const prevMine = msgs[i - 1]?.from === m.from;
          return (
            <View
              key={m.id}
              style={[styles.row, mine ? styles.rowMine : styles.rowTheirs, prevMine && styles.rowTight]}
            >
              {!mine && !prevMine ? <Text style={styles.who}>{m.from}</Text> : null}
              <View style={[styles.msg, mine ? styles.msgMine : styles.msgTheirs]}>
                <Text style={[styles.msgText, mine ? styles.msgTextMine : styles.msgTextTheirs]}>
                  {m.text}
                </Text>
              </View>
              <Text style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}>{m.at}</Text>
            </View>
          );
        })}
      </View>
      <Rule />
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Message the head…"
          placeholderTextColor={ink.ash}
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={500}
        />
        <Action label="Send" disabled={!draft.trim()} onPress={send} testID="send" />
      </View>
    </KeyboardAvoidingView>
  );
}

function nowHM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ink.paper },
  header: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter, gap: 12 },
  stationLabel: { ...type.label, fontSize: 15, color: ink.ink },
  thread: { flex: 1, paddingHorizontal: layout.gutter, paddingVertical: 16, gap: 12 },
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
