/**
 * IT Admin app — meal balance top-up or comp.
 *
 * The amount is a number of whole units, never a free-text money string, and
 * the reason is a fixed pick: TOPUP (cash taken at the desk), COMP (house),
 * REFUND (complaint). The ledger is append-only and the reason is what makes
 * a discrepancy auditable later, so it is not optional here.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Action, Card, Eyebrow, ink, layout, Rule, type } from '@mianu/ui';

type Reason = 'TOPUP' | 'COMP' | 'REFUND';
const REASONS: Array<{ id: Reason; label: string }> = [
  { id: 'TOPUP', label: 'Top-up · cash taken' },
  { id: 'COMP', label: 'Comp · on the house' },
  { id: 'REFUND', label: 'Refund · complaint' },
];
const QUICK = [500, 1000, 2000];

export function TopUpScreen() {
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState<Reason>('TOPUP');
  const [done, setDone] = useState<{ name: string; balance: number } | null>(null);

  if (done) {
    return (
      <View style={styles.screen}>
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
                <Text style={styles.balance}>{(done.balance / 100).toFixed(2)} <Text style={styles.currency}>DZD</Text></Text>
              </View>
            </View>
          </Card>
          <View style={styles.stack}>
            <Action label="Next top-up" onPress={() => { setDone(null); setCode(''); setAmount(null); }} testID="topup-next" />
          </View>
        </View>
      </View>
    );
  }

  const balanceAfter = (amount ?? 0) + 5000;

  return (
    <View style={styles.screen}>
      <Header label="BALANCE · TOP-UP" />
      <View style={styles.body}>
        <Card>
          <Eyebrow>Participant alt code</Eyebrow>
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
            keyboardType="number-pad"
            placeholder="Custom"
            placeholderTextColor={ink.ash}
            value={amount !== null ? String(amount / 100) : ''}
            onChangeText={(t) => {
              const n = Number(t.replace(/[^0-9.]/g, ''));
              setAmount(Number.isFinite(n) ? Math.round(n * 100) : null);
            }}
          />
          <Text style={styles.preview}>
            Balance after: <Text style={styles.previewBold}>{(balanceAfter / 100).toFixed(2)} DZD</Text>
          </Text>
        </Card>

        <Card>
          <Eyebrow>Reason</Eyebrow>
          {REASONS.map((r, i) => (
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
            label="Commit top-up"
            disabled={code.trim().length < 2 || !amount || amount <= 0}
            onPress={() => setDone({ name: 'S. Benali', balance: balanceAfter })}
            testID="commit-topup"
          />
        </View>
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

function reasonLabel(r: Reason): string {
  return r === 'TOPUP' ? 'Top-up recorded' : r === 'COMP' ? 'Meal comped' : 'Refund recorded';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ink.paper },
  header: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter, gap: 12 },
  body: { flex: 1, paddingHorizontal: layout.gutter, paddingTop: 20, gap: 14 },
  stationLabel: { ...type.label, fontSize: 15, color: ink.ink },
  verdictWrap: { gap: 8, marginBottom: 8 },
  verdict: { ...type.verdict, color: ink.ink },
  kind: { ...type.label, fontSize: 12, color: ink.ash },
  name: { ...type.name, color: ink.ink, marginTop: 4, marginBottom: 14 },
  facts: { gap: 12 },
  fact: { gap: 4 },
  factLabel: { ...type.label, fontSize: 11, color: ink.ash },
  balance: { ...type.verdict, fontSize: 30, color: ink.ink },
  currency: { fontSize: 14, fontWeight: '600', color: ink.ash, letterSpacing: 1 },
  input: {
    borderWidth: layout.hair,
    borderColor: ink.rule,
    borderRadius: 4,
    backgroundColor: ink.paper,
    padding: 14,
    ...type.mono,
    fontSize: 20,
    letterSpacing: 5,
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
});
