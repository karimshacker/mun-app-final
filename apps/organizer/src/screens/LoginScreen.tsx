/**
 * PIN login — the only door into the app. Phone number + 4-8 digit PIN,
 * both validated server-side against the salted hash. The session persists
 * across app kills via src/lib/session.ts.
 *
 * Keyboard UX: the form scrolls above the keyboard, Return jumps
 * phone → PIN → sign-in, the action stays pinned in a footer (never covered),
 * and an explicit Dismiss control closes the keyboard for anyone who prefers
 * tapping to the iOS swipe.
 */
import { createRef, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Action, Card, Eyebrow, ink, layout, Rule, Screen, type } from '@mianu/ui';
import { api } from '../lib/api';
import type { AuthSession } from '@mianu/types';

export function LoginScreen({ onSignedIn }: { onSignedIn: (s: AuthSession) => void }) {
  const pinRef = useRef<TextInput>(null);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const session = await api.login(phone.trim(), pin.trim());
      onSignedIn(session);
    } catch (e: any) {
      setError(
        e?.code === 'offline'
          ? 'No connection. Find signal and try again.'
          : e?.code === 'unauthorized'
            ? 'Wrong phone or PIN. Try once more.'
            : 'Sign-in failed. Try once more.',
      );
    } finally {
      setBusy(false);
    }
  };

  const ready = phone.trim().length >= 6 && pin.trim().length >= 4 && !busy;

  return (
    <Screen footer={<Action label={busy ? 'Signing in…' : 'Sign in'} disabled={!ready} onPress={submit} testID="login-submit" />}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.stationLabel}>MIANU-SM IV · ORGANIZER</Text>
            <Rule />
          </View>
          <View style={styles.body}>
            <Card>
              <Eyebrow>Phone number</Eyebrow>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                autoComplete="tel"
                placeholder="+213…"
                placeholderTextColor={ink.ash}
                value={phone}
                onChangeText={setPhone}
                returnKeyType="next"
                onSubmitEditing={() => pinRef.current?.focus()}
                submitBehavior="submit"
              />
            </Card>
            <Card>
              <Eyebrow>PIN</Eyebrow>
              <TextInput
                ref={pinRef}
                style={styles.input}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={8}
                placeholder="····"
                placeholderTextColor={ink.ash}
                value={pin}
                onChangeText={(t) => setPin(t.replace(/[^0-9]/g, ''))}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (ready) submit();
                }}
              />
            </Card>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: layout.gutter },
  header: { paddingTop: layout.gutter, gap: 12 },
  body: { flex: 1, justifyContent: 'center', gap: 14, paddingVertical: 24 },
  stationLabel: { ...type.label, fontSize: 13, color: ink.ink },
  input: {
    borderWidth: layout.hair,
    borderColor: ink.rule,
    borderRadius: 4,
    backgroundColor: ink.paper,
    paddingVertical: 13,
    paddingHorizontal: 14,
    ...type.mono,
    fontSize: 19,
    letterSpacing: 2,
    color: ink.ink,
  },
  error: { ...type.body, color: ink.ink, textAlign: 'center', fontWeight: '600' },
});
