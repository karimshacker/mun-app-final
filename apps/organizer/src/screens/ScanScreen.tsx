import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import { api } from '../lib/api';
import type { ScanResult, StationType } from '@mianu/types';
import { Action, Card, Eyebrow, GhostLink, ink, layout, Mono, Rule, type, VerdictTone } from '@mianu/ui';

interface Props {
  stationType: StationType;
  committeeId?: string;
  mealType?: 'BREAKFAST' | 'LUNCH';
  /** label shown above the target, e.g. "MAIN ENTRANCE" / "HALL 3 · SOCHUM" */
  stationLabel: string;
}

/**
 * The scanning surface used at the main entrance, every hall door, and both
 * meal stations. One screen, three modes (idle / typing code / receipt).
 *
 * Deliberate UX decisions:
 *  - the NFC action is the only large target on the idle screen, because at a
 *    door the operator is holding badges and needs a thumb-sized hit area.
 *  - the alt-code fallback is a small underlined link, not a button of equal
 *    weight, so nobody reaches for typing by accident.
 *  - after every scan we show a full receipt with a verdict, and the *only*
 *    way on is the bottom "NEXT" action — a clear checkpoint per person.
 */
export function ScanScreen({ stationType, committeeId, mealType, stationLabel }: Props) {
  const [altMode, setAltMode] = useState(false);
  const [altCode, setAltCode] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (badgeUid?: string, code?: string) => {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const res = await api.scan({
        badgeUid,
        altCode: code,
        stationType,
        committeeId,
        mealType,
        clientScanId: `${deviceStamp()}-${Date.now()}`,
      });
      setResult(res);
    } catch (e: any) {
      setError(e.code ? humanError(e.code) : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const scanNfc = async () => {
    setError(null);
    setBusy(true);
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      const uid = (tag?.id ?? '').toLowerCase();
      if (!uid) throw new Error('empty_tag');
      await submit(uid);
    } catch (e: any) {
      setError(
        /not_supported|unavailable|tag_response|empty_tag/i.test(String(e?.message ?? ''))
          ? 'NFC unavailable on this device. Use the code on the badge.'
          : 'Scan failed. Hold the badge flat against the top of the phone.',
      );
    } finally {
      NfcManager.cancelTechnologyRequest();
      setBusy(false);
    }
  };

  if (result) {
    return <Receipt result={result} stationLabel={stationLabel} onDone={() => setResult(null)} />;
  }

  if (altMode) {
    return (
      <Screen stationLabel={stationLabel}>
        <Card>
          <Eyebrow>Type the code</Eyebrow>
          <Text style={styles.hint}>Printed in the corner of the badge.</Text>
          <TextInput
            style={styles.input}
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="A4F2"
            placeholderTextColor={ink.ash}
            value={altCode}
            onChangeText={(t) => setAltCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          />
          <View style={styles.stack}>
            <Action
              label={busy ? 'Submitting…' : 'Submit code'}
              disabled={altCode.trim().length < 2 || busy}
              onPress={() => submit(undefined, altCode.trim())}
              testID="submit-code"
            />
          </View>
          <View style={styles.rowCenter}>
            <GhostLink label="Scan NFC instead" onPress={() => { setAltMode(false); setError(null); }} />
          </View>
        </Card>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Screen>
    );
  }

  return (
    <Screen stationLabel={stationLabel}>
      <Card>
        <Eyebrow>Participant badge</Eyebrow>
        <Text style={styles.hint}>Hold the badge flat against the back of the phone, chip down.</Text>
        <View style={styles.stack}>
          <Action
            label={busy ? 'Reading…' : 'Hold badge to scan'}
            disabled={busy}
            onPress={scanNfc}
            testID="scan-nfc"
          />
        </View>
        <View style={styles.rowCenter}>
          <GhostLink label="Badge won't scan · Type code instead" onPress={() => { setAltMode(true); setError(null); }} />
        </View>
      </Card>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

/** Header block that identifies the station so an operator never scans into the wrong queue. */
function Screen({ stationLabel, children }: { stationLabel: string; children: React.ReactNode }) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.stationLabel}>{stationLabel}</Text>
        <Rule />
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

/** Full-bleed verdict. Denied inverts to white-on-black — the loudest thing in the system. */
export function Receipt({
  result,
  stationLabel,
  onDone,
}: {
  result: ScanResult;
  stationLabel: string;
  onDone: () => void;
}) {
  const tone = toneFor(result.outcome);
  const denied = tone === 'deny';
  const p = result.participant;

  return (
    <View style={[styles.screen, denied && styles.screenInvert]}>
      <View style={styles.header}>
        <Text style={[styles.stationLabel, denied && styles.textInvert]}>{stationLabel}</Text>
        <Rule invert={denied} />
      </View>
      <View style={styles.body}>
        <View style={styles.verdictWrap}>
          <Text style={[styles.verdict, denied && styles.verdictInvert]} numberOfLines={2}>
            {messageFor(result.outcome)}
          </Text>
          <Text style={[styles.verdictKind, denied && styles.textInvert]}>{kindFor(result.outcome)}</Text>
        </View>

        {p ? (
          <Card style={[styles.card, denied && styles.cardInvert]}>
            <Eyebrow>Participant</Eyebrow>
            <Text style={[styles.name, denied && styles.textInvert]} numberOfLines={1}>
              {p.name}
            </Text>
            {p.committeeId ? <Mono invert={denied}>{p.committeeId}</Mono> : null}
            <View style={styles.facts}>
              <Fact label="Alt code" value={p.altCode} invert={denied} />
              <Fact label="Meal plan" value={planLabel(p.mealPlan)} invert={denied} />
            </View>
          </Card>
        ) : null}

        {result.balanceCents !== undefined ? (
          <Card style={[styles.card, denied && styles.cardInvert]}>
            <Eyebrow>Balance after this scan</Eyebrow>
            <Text style={[styles.balance, denied && styles.textInvert]}>
              {(result.balanceCents / 100).toFixed(2)} <Text style={styles.currency}>DZD</Text>
            </Text>
          </Card>
        ) : null}

        <View style={styles.stackLarge}>
          <Action label="Next" invert={denied} onPress={onDone} testID="next-scan" />
        </View>
      </View>
    </View>
  );
}

function Fact({ label, value, invert }: { label: string; value: string; invert?: boolean }) {
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, invert && styles.factLabelInvert]}>{label}</Text>
      <Mono invert={invert}>{value}</Mono>
    </View>
  );
}

export function toneFor(outcome: ScanResult['outcome']): VerdictTone {
  if (outcome === 'CHECKED_IN' || outcome === 'CHECKED_OUT' || outcome === 'MEAL_SERVED') return 'go';
  if (outcome === 'NOT_FOUND' || outcome === 'BLOCKED') return 'deny';
  return 'hold';
}

export function messageFor(outcome: ScanResult['outcome']): string {
  switch (outcome) {
    case 'CHECKED_IN': return 'Checked in';
    case 'CHECKED_OUT': return 'Checked out';
    case 'MEAL_SERVED': return 'Meal served';
    case 'ALREADY_IN': return 'Already checked in';
    case 'ALREADY_OUT': return 'Not checked in';
    case 'NOT_FOUND': return 'Unknown badge';
    case 'BLOCKED': return 'Badge blocked';
    case 'MEAL_ALREADY_SERVED': return 'Already ate';
    case 'INSUFFICIENT_BALANCE': return 'No balance left';
    case 'MEAL_NOT_IN_PLAN': return 'Not on this meal plan';
    default: return 'Try again';
  }
}

/** Short machine-style tag under the verdict — operator jargon, kept flat. */
export function kindFor(outcome: ScanResult['outcome']): string {
  switch (outcome) {
    case 'CHECKED_IN': return 'CONFERENCE · IN';
    case 'CHECKED_OUT': return 'CONFERENCE · OUT';
    case 'MEAL_SERVED': return 'DEDUCTED · LEDGER';
    case 'ALREADY_IN': return 'IDLE · NO CHANGE';
    case 'ALREADY_OUT': return 'IDLE · NO CHANGE';
    case 'NOT_FOUND': return 'NOT IN ROSTER';
    case 'BLOCKED': return 'SEE IT ADMIN';
    case 'MEAL_ALREADY_SERVED': return 'DUPLICATE · BLOCKED';
    case 'INSUFFICIENT_BALANCE': return 'BALANCE 0';
    case 'MEAL_NOT_IN_PLAN': return 'PLAN MISMATCH';
    default: return 'NO OPINION';
  }
}

function planLabel(plan: string): string {
  switch (plan) {
    case 'FULL': return 'FULL';
    case 'BREAKFAST_ONLY': return 'BREAKFAST';
    case 'LUNCH_ONLY': return 'LUNCH';
    default: return 'NONE';
  }
}

export function humanError(code: string): string {
  switch (code) {
    case 'offline': return 'No connection. Scan refused — find signal, then scan again.';
    case 'unauthorized': return 'Session expired. Sign in again from the app.';
    case 'conflict': return 'Already recorded. Nothing to do — move on.';
    case 'not_found': return 'Unknown badge. Check the code with IT.';
    case 'server': return 'Server problem. Try once more; do not double-scan.';
    default: return 'Something went wrong. Try again.';
  }
}

function deviceStamp(): string {
  // per-install id, so retries of the same physical scan dedupe server-side
  return 'dev'; // TODO: read from secure storage
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ink.paper },
  screenInvert: { backgroundColor: ink.ink },
  header: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter, gap: 12 },
  body: { flex: 1, paddingHorizontal: layout.gutter, paddingTop: 20, gap: 16, justifyContent: 'center' },
  stationLabel: { ...type.label, fontSize: 15, color: ink.ink },
  textInvert: { color: ink.inverse },
  hint: { ...type.body, color: ink.ash, marginBottom: 14 },
  input: {
    borderWidth: layout.hair,
    borderColor: ink.rule,
    borderRadius: 4,
    backgroundColor: ink.paper,
    padding: 18,
    ...type.mono,
    fontSize: 28,
    letterSpacing: 8,
    color: ink.ink,
  },
  stack: { marginTop: 16, gap: 12 },
  stackLarge: { marginTop: 8, gap: 12 },
  rowCenter: { alignItems: 'center', marginTop: 14 },
  card: { marginTop: 0 },
  cardInvert: { backgroundColor: ink.ink, borderColor: ink.inverse },
  verdictWrap: { gap: 8 },
  verdict: { ...type.verdict, color: ink.ink },
  verdictInvert: { color: ink.inverse },
  verdictKind: { ...type.label, fontSize: 12, color: ink.ash },
  name: { ...type.name, color: ink.ink, marginTop: 4 },
  facts: { flexDirection: 'row', gap: 32, marginTop: 14 },
  fact: { gap: 4 },
  factLabel: { ...type.label, fontSize: 11, color: ink.ash },
  factLabelInvert: { color: ink.fog },
  balance: { ...type.verdict, fontSize: 34, color: ink.ink, marginTop: 4 },
  currency: { fontSize: 15, fontWeight: '600', color: ink.ash, letterSpacing: 1 },
  error: { ...type.body, color: ink.ink, textAlign: 'center', marginTop: 4, fontWeight: '600' },
});
