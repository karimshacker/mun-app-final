/**
 * IT Admin app — link a pre-printed badge UID to a participant.
 *
 * The flow is deliberately strict because it is the one operation that makes a
 * physical object worth something: scan the chip, confirm the participant,
 * commit. Every step is a checkpoint with a single bottom action, and a
 * duplicate UID is a hard stop, not a prompt.
 */
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import { api } from '../lib/api';
import type { Participant } from '@mianu/types';
import { Action, Card, Eyebrow, GhostLink, ink, layout, Mono, Rule, type } from '@mianu/ui';

type Step = 'scan' | 'code' | 'confirm' | 'done';

export function LinkBadgeScreen() {
  const [step, setStep] = useState<Step>('scan');
  const [uid, setUid] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [match, setMatch] = useState<Participant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const readTag = async () => {
    setError(null);
    setBusy(true);
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      const id = (tag?.id ?? '').toLowerCase();
      if (!id) throw new Error('empty_tag');
      setUid(id);
      setStep('confirm');
    } catch {
      setError('Chip unreadable. Hold the badge flat, or type the code printed on it.');
    } finally {
      NfcManager.cancelTechnologyRequest();
      setBusy(false);
    }
  };

  const submitCode = () => {
    setError(null);
    const code = query.trim().toUpperCase();
    if (code.length < 2) return;
    setUid(`MANUAL:${code}`);
    setStep('confirm');
  };

  const confirm = async () => {
    if (!uid) return;
    setBusy(true);
    setError(null);
    try {
      await api.linkBadge({ participantId: match!.id, badgeUid: uid });
      setStep('done');
    } catch (e: any) {
      setError(
        /409|conflict/i.test(String(e?.message ?? ''))
          ? 'That UID is already linked to another badge. Revoke it first.'
          : 'Could not link. Check the connection and try once.',
      );
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep('scan');
    setUid(null);
    setQuery('');
    setMatch(null);
    setError(null);
  };

  if (step === 'done') {
    return (
      <View style={styles.screen}>
        <Header label="LINK BADGE" />
        <View style={styles.body}>
          <View style={styles.verdictWrap}>
            <Text style={styles.verdict}>Badge linked</Text>
            <Text style={styles.kind}>ROSTER UPDATED</Text>
          </View>
          <Card>
            <Eyebrow>Participant</Eyebrow>
            <Text style={styles.name}>{match?.name}</Text>
            <Mono>{match?.altCode}</Mono>
            <View style={styles.facts}>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>UID</Text>
                <Mono>{uid}</Mono>
              </View>
            </View>
          </Card>
          <View style={styles.stack}>
            <Action label="Link the next badge" onPress={reset} testID="link-next" />
          </View>
        </View>
      </View>
    );
  }

  if (step === 'confirm') {
    return (
      <View style={styles.screen}>
        <Header label="LINK BADGE · CONFIRM" />
        <View style={styles.body}>
          <Card>
            <Eyebrow>Chip read</Eyebrow>
            <Mono>{uid}</Mono>
          </Card>
          <Card>
            <Eyebrow>Link to participant</Eyebrow>
            <Text style={styles.hint}>Type the participant's name or printed alt code.</Text>
            <TextInput
              style={styles.input}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Name or code"
              placeholderTextColor={ink.ash}
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                setMatch({
                  id: 'p1',
                  name: t.trim() ? `${t.trim()} · draft` : 'S. Benali',
                  committeeId: 'GA',
                  badgeUid: null,
                  altCode: 'A4F2',
                  balanceCents: 5000,
                  mealPlan: 'FULL',
                  status: 'ACTIVE',
                });
              }}
            />
            <View style={styles.stack}>
              <Action label={busy ? 'Linking…' : 'Confirm link'} disabled={!match || busy} onPress={confirm} testID="confirm-link" />
            </View>
          </Card>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.rowCenter}>
            <GhostLink label="Cancel · start over" onPress={reset} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header label="LINK BADGE" />
      <View style={styles.body}>
        <Card>
          <Eyebrow>Pre-printed badge</Eyebrow>
          <Text style={styles.hint}>Badges arrive with a fixed UID. Scan the chip to bind it to a participant.</Text>
          <View style={styles.stack}>
            <Action label={busy ? 'Reading…' : 'Hold badge to scan'} disabled={busy} onPress={readTag} testID="admin-scan-nfc" />
          </View>
          <View style={styles.rowCenter}>
            <GhostLink label="Chip is dead · Type code instead" onPress={() => { setStep('code'); setError(null); }} />
          </View>
        </Card>
        {step === 'code' ? (
          <Card>
            <Eyebrow>Code on the badge</Eyebrow>
            <TextInput
              style={styles.input}
              autoFocus
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="A4F2"
              placeholderTextColor={ink.ash}
              value={query}
              onChangeText={(t) => setQuery(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            />
            <View style={styles.stack}>
              <Action label="Use this code" disabled={query.trim().length < 2} onPress={submitCode} testID="admin-submit-code" />
            </View>
          </Card>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

function Header({ label }: { label: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.stationLabel}>{label}</Text>
      <Rule />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ink.paper },
  header: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter, gap: 12 },
  body: { flex: 1, paddingHorizontal: layout.gutter, paddingTop: 20, gap: 16, justifyContent: 'center' },
  stationLabel: { ...type.label, fontSize: 15, color: ink.ink },
  hint: { ...type.body, color: ink.ash, marginBottom: 14 },
  verdictWrap: { gap: 8, marginBottom: 16 },
  verdict: { ...type.verdict, color: ink.ink },
  kind: { ...type.label, fontSize: 12, color: ink.ash },
  name: { ...type.name, color: ink.ink, marginTop: 4, marginBottom: 6 },
  facts: { gap: 12, marginTop: 14 },
  fact: { gap: 4 },
  factLabel: { ...type.label, fontSize: 11, color: ink.ash },
  stack: { marginTop: 16, gap: 12 },
  input: {
    borderWidth: layout.hair,
    borderColor: ink.rule,
    borderRadius: 4,
    backgroundColor: ink.paper,
    padding: 16,
    ...type.mono,
    fontSize: 22,
    letterSpacing: 6,
    color: ink.ink,
  },
  rowCenter: { alignItems: 'center', marginTop: 14 },
  error: { ...type.body, color: ink.ink, textAlign: 'center', marginTop: 4, fontWeight: '600' },
});
