/**
 * IT Admin app — meal balance top-up or comp, for real: the operator types
 * the participant's printed alt code *or taps their linked badge on the
 * reader*, the screen looks the participant up against the live roster
 * (GET /api/admin/lookup), shows the *actual* current balance, and commits
 * through POST /api/admin/topup, which appends exactly one ledger row and
 * returns the new balance.
 */
import { useEffect, useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Action,
  Card,
  Eyebrow,
  GhostLink,
  ink,
  layout,
  Mono,
  Rule,
  Screen,
  type,
} from '@mianu/ui';
import { api } from '../lib/api';
import {
  readBadgeUid,
  NfcUnavailableError,
  NfcTimeoutError,
  releaseNfc,
} from '../lib/nfc';
import type { ParticipantMatch } from '@mianu/types';

type Reason = 'TOPUP' | 'COMP' | 'REFUND';
const REASONS: Array<{ id: Reason; label: string }> = [
  { id: 'TOPUP', label: 'Top-up · cash taken' },
  { id: 'COMP', label: 'Comp · on the house' },
  { id: 'REFUND', label: 'Refund · complaint' },
];
const QUICK = [500, 1000, 2000];

export function TopUpScreen() {
  const [mode, setMode] = useState<'code' | 'badge'>('code');
  const [code, setCode] = useState('');
  const [reading, setReading] = useState(false);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const [participant, setParticipant] = useState<ParticipantMatch | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState<Reason>('TOPUP');
  const [done, setDone] = useState<{ name: string; balance: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Live lookup as the code is typed; commits to the server only on Confirm.
  useEffect(() => {
    if (mode !== 'code') return;
    const c = code.trim();
    if (c.length < 3) {
      setParticipant(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const p = await api.lookupAltCode(c.toUpperCase());
        if (!cancelled) {
          setParticipant(p);
          setError(p ? null : 'No participant with that code yet.');
        }
      } catch {
        if (!cancelled) setError('Lookup failed. Check the connection.');
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [code, mode]);

  const readTag = async () => {
    setNfcError(null);
    setError(null);
    setReading(true);
    try {
      const { uid } = await readBadgeUid();
      const p = await api.lookupBadgeUid(uid);
      setParticipant(p);
      if (!p) {
        setError(
          'That badge is not linked to anyone yet. Link it on the Badges tab first.',
        );
      }
    } catch (e: any) {
      if (e instanceof NfcTimeoutError) {
        setNfcError('No badge read. Hold it flat against the phone and try again.');
      } else if (e instanceof NfcUnavailableError) {
        setNfcError('NFC is off or unavailable. Use the alt code instead.');
      } else if (e?.code === 'offline') {
        setNfcError('No connection. Find signal and try again.');
      } else {
        setNfcError('Lookup failed. Check the connection and try again.');
      }
    } finally {
      await releaseNfc();
      setReading(false);
    }
  };

  const commit = async () => {
    if (!participant || !amount || amount <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const { balanceCents } = await api.topUp({
        altCode: participant.altCode,
        amountCents: amount,
        reason,
      });
      setDone({ name: participant.name, balance: balanceCents });
    } catch (e: any) {
      setError(
        e?.code === 'not_found'
          ? 'That code is not on the roster. Check it with the desk.'
          : e?.code === 'offline'
            ? 'No connection. Top-ups need the server — find signal and retry.'
            : 'Could not commit. Check the connection and try once.',
      );
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setDone(null);
    setMode('code');
    setCode('');
    setParticipant(null);
    setAmount(null);
    setReason('TOPUP');
    setError(null);
    setNfcError(null);
  };

  if (done) {
    return (
      <Screen scroll>
        <Header label="BALANCE" />
        <View style={styles.body}>
          <View style={styles.verdictWrap}>
            <Text style={styles.verdict}>{reasonLabel(reason)}</Text>
            <Text style={styles.kind}>LEDGER APPENDED</Text>
          </View>
          <Card>
            <Eyebrow>Participant</Eyebrow>
            <Text style={styles.name}>{done.name}</Text>
            <View style={styles.facts}>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>New balance</Text>
                <Text style={styles.balance}>
                  {(done.balance / 100).toFixed(2)}{' '}
                  <Text style={styles.currency}>DZD</Text>
                </Text>
              </View>
            </View>
          </Card>
          <View style={styles.stack}>
            <Action label="Next top-up" onPress={reset} testID="topup-next" />
          </View>
        </View>
      </Screen>
    );
  }

  const balanceAfter = participant ? participant.balanceCents + (amount ?? 0) : null;

  return (
    <Screen scroll>
      <Header label="BALANCE · TOP-UP" />
      <View style={styles.body}>
        <Card>
          <Eyebrow>Find participant</Eyebrow>
          <View style={styles.modeRow}>
            <ModeTab
              label="Type alt code"
              active={mode === 'code'}
              onPress={() => {
                setMode('code');
                setNfcError(null);
              }}
            />
            <ModeTab
              label="Tap badge"
              active={mode === 'badge'}
              onPress={() => {
                setMode('badge');
                setParticipant(null);
                setError(null);
              }}
            />
          </View>

          {mode === 'code' ? (
            <View>
              <TextInput
                style={styles.input}
                autoFocus
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="A4F2"
                placeholderTextColor={ink.ash}
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              />
              {participant ? (
                <View style={styles.participantRow}>
                  <Text style={styles.participantName}>{participant.name}</Text>
                  <Text style={styles.participantMeta}>
                    {participant.committeeName ?? '—'} · current balance{' '}
                    {(participant.balanceCents / 100).toFixed(2)} DZD
                  </Text>
                </View>
              ) : code.trim().length >= 3 && !error ? (
                <Text style={styles.hint}>Looking up…</Text>
              ) : null}
            </View>
          ) : (
            <View>
              <Text style={styles.hint}>
                Hold the participant's badge flat against the back of the phone.
                Only badges already linked on the Badges tab resolve here.
              </Text>
              <View style={styles.stack}>
                <Action
                  label={reading ? 'Reading…' : 'Tap badge to look up'}
                  disabled={reading}
                  onPress={readTag}
                  testID="topup-tap-badge"
                />
              </View>
              {participant ? (
                <View style={styles.participantRow}>
                  <Text style={styles.participantName}>{participant.name}</Text>
                  <Text style={styles.participantMeta}>
                    {participant.committeeName ?? '—'} · badge{' '}
                    <Mono>{participant.badgeUid}</Mono> · current balance{' '}
                    {(participant.balanceCents / 100).toFixed(2)} DZD
                  </Text>
                </View>
              ) : null}
              {nfcError ? <Text style={styles.hint}>{nfcError}</Text> : null}
            </View>
          )}
        </Card>

        <Card>
          <Eyebrow>Amount</Eyebrow>
          <View style={styles.quickRow}>
            {QUICK.map((q) => (
              <Pressable
                key={q}
                onPress={() => setAmount(q)}
                hitSlop={6}
                style={[styles.quick, amount === q && styles.quickActive]}
                accessibilityRole="button"
                accessibilityLabel={`${q}`}
              >
                <Text style={[styles.quickText, amount === q && styles.quickTextActive]}>
                  {q / 100}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[styles.input, styles.amountInput]}
            keyboardType="decimal-pad"
            placeholder="Custom"
            placeholderTextColor={ink.ash}
            value={amount !== null ? String(amount / 100) : ''}
            onChangeText={(t) => {
              // keep at most one dot, and let trailing dots through while
              // typing ("12." must not collapse to "12")
              const cleaned = t.replace(/[^0-9.]/g, '');
              const first = cleaned.indexOf('.');
              const normalized =
                first === -1
                  ? cleaned
                  : cleaned.slice(0, first + 1) + cleaned.slice(first + 1).replace(/\./g, '');
              if (normalized === '' || normalized === '.') {
                setAmount(null);
                return;
              }
              const n = Number(normalized);
              setAmount(Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null);
            }}
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          <Text style={styles.preview}>
            Balance after:{' '}
            <Text style={styles.previewBold}>
              {balanceAfter != null ? `${(balanceAfter / 100).toFixed(2)} DZD` : '—'}
            </Text>
          </Text>
        </Card>

        <Card>
          <Eyebrow>Reason</Eyebrow>
          {REASONS.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => setReason(r.id)}
              hitSlop={6}
              style={[styles.reason, reason === r.id && styles.reasonActive]}
              accessibilityRole="button"
            >
              <View style={[styles.reasonMark, reason === r.id && styles.reasonMarkActive]} />
              <Text style={[styles.reasonText, reason === r.id && styles.reasonTextActive]}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </Card>

        <View style={styles.stack}>
          <Action
            label={busy ? 'Committing…' : 'Commit top-up'}
            disabled={!participant || !amount || amount <= 0 || busy}
            onPress={() => {
              Keyboard.dismiss();
              commit();
            }}
            testID="commit-topup"
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </Screen>
  );
}

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      style={[styles.modeTab, active && styles.modeTabActive]}
    >
      <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{label}</Text>
    </Pressable>
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

function reasonLabel(r: Reason): string {
  return r === 'TOPUP' ? 'Top-up recorded' : r === 'COMP' ? 'Meal comped' : 'Refund recorded';
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter, gap: 12 },
  body: { paddingHorizontal: layout.gutter, paddingTop: 20, paddingBottom: 16, gap: 14 },
  stationLabel: { ...type.label, fontSize: 13, color: ink.ink },
  verdictWrap: { gap: 8, marginBottom: 8 },
  verdict: { ...type.verdict, color: ink.ink },
  kind: { ...type.label, fontSize: 12, color: ink.ash },
  name: { ...type.name, color: ink.ink, marginTop: 4, marginBottom: 14 },
  facts: { gap: 12 },
  fact: { gap: 4 },
  factLabel: { ...type.label, fontSize: 11, color: ink.ash },
  balance: { ...type.verdict, fontSize: 26, color: ink.ink },
  currency: { fontSize: 14, fontWeight: '600', color: ink.ash, letterSpacing: 1 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeTab: {
    flex: 1,
    borderWidth: layout.hair,
    borderColor: ink.rule,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modeTabActive: { backgroundColor: ink.ink },
  modeTabText: { ...type.label, fontSize: 11, color: ink.ink },
  modeTabTextActive: { color: ink.inverse },
  participantRow: { marginTop: 12, gap: 2 },
  participantName: { ...type.body, fontSize: 15, color: ink.ink, fontWeight: '700' },
  participantMeta: { ...type.body, fontSize: 13, color: ink.ash },
  input: {
    borderWidth: layout.hair,
    borderColor: ink.rule,
    borderRadius: 4,
    backgroundColor: ink.paper,
    paddingVertical: 13,
    paddingHorizontal: 14,
    ...type.mono,
    fontSize: 17,
    letterSpacing: 4,
    color: ink.ink,
  },
  amountInput: { letterSpacing: 2 },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quick: { flex: 1, borderWidth: 1, borderColor: ink.rule, paddingVertical: 12, alignItems: 'center' },
  quickActive: { backgroundColor: ink.ink },
  quickText: { ...type.label, fontSize: 13, color: ink.ink },
  quickTextActive: { color: ink.inverse },
  preview: { ...type.body, fontSize: 14, color: ink.ash, marginTop: 12 },
  previewBold: { color: ink.ink, fontWeight: '800' },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  reasonActive: {},
  reasonMark: { width: 14, height: 14, borderWidth: 1, borderColor: ink.rule, backgroundColor: ink.paper },
  reasonMarkActive: { backgroundColor: ink.ink },
  reasonText: { ...type.body, fontSize: 15, color: ink.ink },
  reasonTextActive: { fontWeight: '800' },
  stack: { marginTop: 4, gap: 12 },
  hint: { ...type.body, fontSize: 13, color: ink.ash, marginTop: 10 },
  error: { ...type.body, color: ink.ink, textAlign: 'center', fontWeight: '600' },
});
