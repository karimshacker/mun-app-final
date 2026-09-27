/**
 * The roster view: search any delegate by name or alt code and see what the
 * desk needs — committee, printed code, meal plan, balance, badge status.
 * This is the read side of the same table enrollment writes; when a delegate
 * says "my badge stopped working", this is where IT checks whether a chip is
 * linked and what their plan allows before touching anything.
 */
import { useCallback, useEffect, useState } from 'react';
// Search submits explicitly — the venue network is slow enough that
// per-keystroke queries would queue up.
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, Eyebrow, ink, layout, Mono, Rule, Screen, type } from '@mianu/ui';
import { api } from '../lib/api';
import type { ParticipantMatch } from '@mianu/types';

function money(cents: number): string {
  return `${(cents / 100).toFixed(2)} DZD`;
}

export function RosterScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ParticipantMatch[] | null>(null);
  const [selected, setSelected] = useState<ParticipantMatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setError('Type at least 2 characters.');
      setResults(null);
      return;
    }
    setBusy(true);
    try {
      const participants = await api.searchParticipants(q.trim());
      setResults(participants);
      setSelected(null);
      setError(null);
    } catch {
      setError('Search failed. Check the connection.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setError(null);
    }
  }, [query]);

  if (selected) {
    return (
      <Screen scroll>
        <View style={styles.header}>
          <Text style={styles.label}>ROSTER · {selected.name.toUpperCase()}</Text>
          <Rule />
        </View>
        <View style={styles.body}>
          <Card>
            <Eyebrow>Delegate</Eyebrow>
            <Text style={styles.name}>{selected.name}</Text>
            <Mono>{selected.altCode}</Mono>
            <View style={styles.facts}>
              <Fact label="Committee" value={selected.committeeName ?? '—'} />
              <Fact label="Meal plan" value={planLabel(selected.mealPlan)} />
            </View>
          </Card>
          <Card>
            <Eyebrow>Balance</Eyebrow>
            <Text style={styles.balance}>{money(selected.balanceCents)}</Text>
          </Card>
          <Card>
            <Eyebrow>Badge</Eyebrow>
            {selected.badgeUid ? (
              <>
                <Mono>{selected.badgeUid}</Mono>
                <Text style={styles.badgeOk}>Chip linked — taps will resolve to this delegate.</Text>
              </>
            ) : (
              <Text style={styles.badgeMissing}>
                No chip linked — the alt code is the only entry method. Bind one on the Badges tab.
              </Text>
            )}
          </Card>
          <View style={styles.stack}>
            <Card>
              <Text onPress={() => setSelected(null)} style={styles.backLink}>
                Back to results
              </Text>
            </Card>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll>
        <View style={styles.header}>
          <Text style={styles.label}>ROSTER</Text>
          <Rule />
        </View>
        <View style={styles.body}>
          <Card>
            <Eyebrow>Search by name or alt code</Eyebrow>
            <TextInput
              style={styles.input}
              placeholder="Amina or DM01"
              placeholderTextColor={ink.ash}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => {
                Keyboard.dismiss();
                search(query);
              }}
              submitBehavior="submit"
            />
            <View style={styles.stack}>
              <Text onPress={() => search(query)} style={styles.searchLink}>
                {busy ? 'Searching…' : 'Search'}
              </Text>
            </View>
          </Card>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {(results ?? []).map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setSelected(p)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              accessibilityRole="button"
            >
              <View style={styles.topRow}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.rowCommittee}>{p.committeeName ?? '—'}</Text>
              </View>
              <Mono>{p.altCode}</Mono>
              <Rule />
            </Pressable>
          ))}
          {results && results.length === 0 && !error ? (
            <Text style={styles.error}>Nobody matches. Check the spelling with the delegate.</Text>
          ) : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function planLabel(plan: string): string {
  switch (plan) {
    case 'FULL': return 'FULL';
    case 'BREAKFAST_ONLY': return 'BREAKFAST';
    case 'LUNCH_ONLY': return 'LUNCH';
    default: return 'NONE';
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter, gap: 12 },
  body: { paddingHorizontal: layout.gutter, paddingTop: 18, paddingBottom: 12, gap: 14 },
  label: { ...type.label, fontSize: 15, color: ink.ink },
  input: {
    borderWidth: layout.hair,
    borderColor: ink.rule,
    borderRadius: 4,
    paddingVertical: 13,
    paddingHorizontal: 14,
    ...type.mono,
    fontSize: 17,
    letterSpacing: 2,
    color: ink.ink,
    marginTop: 8,
  },
  stack: { marginTop: 10, gap: 10 },
  searchLink: { ...type.label, fontSize: 13, color: ink.ink, textDecorationLine: 'underline' },
  backLink: { ...type.label, fontSize: 13, color: ink.ink, textDecorationLine: 'underline' },
  error: { ...type.body, fontSize: 12, color: ink.ink, fontWeight: '600' },
  name: { ...type.verdict, fontSize: 24, color: ink.ink, marginVertical: 8 },
  balance: { ...type.verdict, fontSize: 30, color: ink.ink, marginTop: 4 },
  facts: { flexDirection: 'row', gap: 32, marginTop: 14 },
  fact: { gap: 4 },
  factLabel: { ...type.label, fontSize: 11, color: ink.ash },
  factValue: { ...type.body, fontSize: 14, color: ink.ink, fontWeight: '600' },
  badgeOk: { ...type.body, fontSize: 13, color: ink.ash, marginTop: 8 },
  badgeMissing: { ...type.body, fontSize: 13, color: ink.ink, marginTop: 8, fontWeight: '600' },
  row: { gap: 6, paddingVertical: 12 },
  rowPressed: { opacity: 0.5 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  rowName: { ...type.body, fontSize: 16, fontWeight: '600', color: ink.ink, flexShrink: 1 },
  rowCommittee: { ...type.label, fontSize: 11, color: ink.ash },
});
