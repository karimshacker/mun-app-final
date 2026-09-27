/**
 * IT Admin app — enrollment desk. Scan a blank badge, type the delegate's
 * name, committee, and alt code; submit creates the participant and binds
 * the chip in one atomic call (POST /api/admin/enroll). Steps are
 * checkpoints: scan → details → done. Conflicts (chip already linked, alt
 * code taken) are hard stops with the offending record named.
 */
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
import type { CommitteeInfo } from '@mianu/types';

type Step = 'scan' | 'details' | 'done';

export function LinkBadgeScreen() {
  const [step, setStep] = useState<Step>('scan');
  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [committeeId, setCommitteeId] = useState<string | null>(null);
  const [committees, setCommittees] = useState<CommitteeInfo[] | null>(null);
  const [altCode, setAltCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<TextInput>(null);
  const altRef = useRef<TextInput>(null);

  // Committee options for the picker, loaded once the chip is read.
  useEffect(() => {
    if (step !== 'details' || committees) return;
    api
      .searchCommittees()
      .then(setCommittees)
      .catch(() => setCommittees([])); // offline: the picker shows a retry line
  }, [step, committees]);

  const readTag = async () => {
    setError(null);
    setBusy(true);
    try {
      const { uid: chipUid } = await readBadgeUid();
      setUid(chipUid);
      setStep('details');
    } catch (e: any) {
      if (e instanceof NfcTimeoutError) {
        setError('No chip read. Hold the badge flat and try again.');
      } else if (e instanceof NfcUnavailableError) {
        setError(
          'NFC is off or unavailable. Enrollment needs the chip — open the app in the EAS build, not Expo Go.',
        );
      } else {
        setError('Chip unreadable. Hold the badge flat against the top of the phone.');
      }
    } finally {
      await releaseNfc();
      setBusy(false);
    }
  };

  const enroll = async () => {
    if (!uid || !committeeId) return;
    setBusy(true);
    setError(null);
    try {
      await api.enrollBadge({
        badgeUid: uid,
        name: name.trim(),
        committeeId,
        altCode: altCode.trim().toUpperCase(),
      });
      setStep('done');
    } catch (e: any) {
      if (e?.code === 'conflict') {
        setError('That chip or alt code is already on the roster. Unlink it first, or type a new code.');
      } else if (e?.code === 'not_found') {
        setError('Committee not found — pick it from the list again.');
      } else if (e?.code === 'offline') {
        setError('No connection. Enrollment needs the server — find signal and retry.');
      } else {
        setError('Could not enroll. Check the connection and try once.');
      }
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep('scan');
    setUid(null);
    setName('');
    setCommitteeId(null);
    setAltCode('');
    setError(null);
  };

  if (step === 'done') {
    return (
      <Screen scroll>
        <Header label="LINK BADGE" />
        <View style={styles.body}>
          <View style={styles.verdictWrap}>
            <Text style={styles.verdict}>Badge enrolled</Text>
            <Text style={styles.kind}>ROSTER UPDATED · CHIP BOUND</Text>
          </View>
          <Card>
            <Eyebrow>Delegate</Eyebrow>
            <Text style={styles.name}>{name.trim()}</Text>
            <View style={styles.facts}>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>Alt code</Text>
                <Mono>{altCode.trim().toUpperCase()}</Mono>
              </View>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>Chip UID</Text>
                <Mono>{uid}</Mono>
              </View>
            </View>
          </Card>
          <View style={styles.stack}>
            <Action label="Enroll the next badge" onPress={reset} testID="link-next" />
          </View>
        </View>
      </Screen>
    );
  }

  if (step === 'details') {
    const ready = name.trim().length >= 2 && !!committeeId && altCode.trim().length >= 2 && !busy;
    return (
      <Screen scroll>
        <Header label="LINK BADGE · DETAILS" />
        <View style={styles.body}>
          <Card>
            <Eyebrow>Chip read</Eyebrow>
            <Mono>{uid}</Mono>
          </Card>
          <Card>
            <Eyebrow>Delegate details</Eyebrow>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              ref={nameRef}
              style={styles.input}
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="Full name"
              placeholderTextColor={ink.ash}
              value={name}
              onChangeText={setName}
              returnKeyType="next"
              onSubmitEditing={() => altRef.current?.focus()}
              submitBehavior="submit"
            />
            <Text style={styles.fieldLabel}>Alt code</Text>
            <TextInput
              ref={altRef}
              style={styles.input}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="A4F2"
              placeholderTextColor={ink.ash}
              value={altCode}
              onChangeText={(t) => setAltCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              maxLength={12}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            <Text style={styles.fieldLabel}>Committee</Text>
            {committees === null ? (
              <Text style={styles.hint}>Loading committees…</Text>
            ) : committees.length === 0 ? (
              <Text style={styles.hint}>Committee list unavailable. Check the connection and go back.</Text>
            ) : (
              <View style={styles.committeeWrap}>
                {committees.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setCommitteeId(c.id)}
                    accessibilityRole="button"
                    accessibilityLabel={c.name}
                    style={[styles.committeeChip, committeeId === c.id && styles.committeeChipActive]}
                  >
                    <Text
                      style={[
                        styles.committeeChipText,
                        committeeId === c.id && styles.committeeChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={styles.hint}>
              New delegates start on the FULL meal plan with a 0.00 DZD balance — top up on the Balance tab.
            </Text>
            <View style={styles.stack}>
              <Action
                label={busy ? 'Enrolling…' : 'Create and link badge'}
                disabled={!ready}
                onPress={() => {
                  Keyboard.dismiss();
                  enroll();
                }}
                testID="confirm-link"
              />
            </View>
          </Card>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.rowCenter}>
            <GhostLink label="Cancel · start over" onPress={reset} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header label="LINK BADGE" />
      <View style={styles.body}>
        <Card>
          <Eyebrow>Blank badge</Eyebrow>
          <Text style={styles.hint}>
            Scan the chip, enter the delegate's details, and the roster gets a new participant with the chip already
            bound.
          </Text>
          <View style={styles.stack}>
            <Action
              label={busy ? 'Reading…' : 'Hold badge to scan'}
              disabled={busy}
              onPress={readTag}
              testID="admin-scan-nfc"
            />
          </View>
        </Card>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </Screen>
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
  header: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter, gap: 12 },
  body: { paddingHorizontal: layout.gutter, paddingTop: 20, paddingBottom: 16, gap: 16 },
  stationLabel: { ...type.label, fontSize: 13, color: ink.ink },
  hint: { ...type.body, fontSize: 13, color: ink.ash, marginTop: 10 },
  verdictWrap: { gap: 8, marginBottom: 8 },
  verdict: { ...type.verdict, color: ink.ink },
  kind: { ...type.label, fontSize: 12, color: ink.ash },
  name: { ...type.name, color: ink.ink, marginTop: 4, marginBottom: 6 },
  facts: { flexDirection: 'row', gap: 28, marginTop: 14 },
  fact: { gap: 4 },
  factLabel: { ...type.label, fontSize: 11, color: ink.ash },
  fieldLabel: { ...type.label, fontSize: 11, color: ink.ash, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: layout.hair,
    borderColor: ink.rule,
    borderRadius: 4,
    backgroundColor: ink.paper,
    paddingVertical: 13,
    paddingHorizontal: 14,
    ...type.mono,
    fontSize: 17,
    letterSpacing: 2,
    color: ink.ink,
  },
  committeeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  committeeChip: {
    borderWidth: layout.hair,
    borderColor: ink.rule,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  committeeChipActive: { backgroundColor: ink.ink },
  committeeChipText: { ...type.label, fontSize: 12, color: ink.ink },
  committeeChipTextActive: { color: ink.inverse },
  stack: { marginTop: 16, gap: 12 },
  rowCenter: { alignItems: 'center', marginTop: 4 },
  error: { ...type.body, color: ink.ink, textAlign: 'center', marginTop: 4, fontWeight: '600' },
});
