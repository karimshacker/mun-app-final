/**
 * The station picker — the first screen after sign-in. An organizer works one
 * station at a time, so the flow is: pick station → scan → receipt → back.
 * The list is the live committee table plus the two conference directions,
 * both meal services, and per-hall IN *and* OUT rows; nothing here is
 * hardcoded per venue. A pinned footer toggle lets the operator go on break,
 * which hides them from the head's presence board while they are away.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Action, Card, Eyebrow, ink, layout, Mono, Rule, Screen, type } from '@mianu/ui';
import { api } from '../lib/api';
import type { CommitteeInfo, StationType } from '@mianu/types';

export interface StationChoice {
  stationType: StationType;
  committeeId?: string;
  mealType?: 'BREAKFAST' | 'LUNCH';
  stationLabel: string;
}

export function StationScreen({ onPick }: { onPick: (choice: StationChoice) => void }) {
  const [committees, setCommittees] = useState<CommitteeInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onBreak, setOnBreak] = useState(false);
  const [breakBusy, setBreakBusy] = useState(false);
  const [breakError, setBreakError] = useState<string | null>(null);

  useEffect(() => {
    api
      .committees()
      .then(({ committees: cs }) => setCommittees(cs))
      .catch(() => setError('Committee list unavailable. Check the connection.'));
  }, []);

  const toggleBreak = useCallback(async () => {
    setBreakBusy(true);
    const next = !onBreak;
    try {
      await api.setBreak(next);
      setOnBreak(next);
      setBreakError(null);
    } catch {
      setBreakError('Could not update break status. Check the connection.');
    } finally {
      setBreakBusy(false);
    }
  }, [onBreak]);

  return (
    <Screen
      scroll
      footer={
        <View style={styles.footer}>
          {breakError ? <Text style={styles.hint}>{breakError}</Text> : null}
          <Action
            label={onBreak ? 'BACK ON DUTY' : 'GO ON BREAK'}
            disabled={breakBusy}
            onPress={toggleBreak}
            invert={onBreak}
            testID="toggle-break"
          />
        </View>
      }
    >
      <View style={styles.header}>
        <Text style={styles.stationLabel}>SELECT STATION</Text>
        {onBreak ? <Text style={styles.breakNote}>ON BREAK — invisible on the head's board</Text> : null}
        <Rule />
      </View>
      <View style={styles.body}>
        <Card>
          <Eyebrow>Conference</Eyebrow>
          <Row label="MAIN ENTRANCE · IN" onPress={() => onPick({ stationType: 'CONFERENCE_IN', stationLabel: 'MAIN ENTRANCE · CHECK-IN' })} />
          <Row label="MAIN ENTRANCE · OUT" onPress={() => onPick({ stationType: 'CONFERENCE_OUT', stationLabel: 'MAIN ENTRANCE · CHECK-OUT' })} last />
        </Card>

        <Card>
          <Eyebrow>Meals</Eyebrow>
          <Row
            label="BREAKFAST LINES"
            onPress={() => onPick({ stationType: 'MEAL', mealType: 'BREAKFAST', stationLabel: 'MEAL STATION · BREAKFAST' })}
          />
          <Row
            label="LUNCH LINES"
            onPress={() => onPick({ stationType: 'MEAL', mealType: 'LUNCH', stationLabel: 'MEAL STATION · LUNCH' })}
            last
          />
        </Card>

        <Card>
          <Eyebrow>Free items</Eyebrow>
          <Row
            label="JOURNAL · ONE PER DAY"
            onPress={() => onPick({ stationType: 'FREE_ITEM', stationLabel: 'JOURNAL DESK' })}
            last
          />
        </Card>

        <Card>
          <Eyebrow>Halls</Eyebrow>
          {error ? <Text style={styles.hint}>{error}</Text> : null}
          {(committees ?? []).map((c, i) => (
            <View key={c.id}>
              <Row
                label={`${c.hallName.toUpperCase()} · ${c.name} · IN`}
                onPress={() =>
                  onPick({
                    stationType: 'HALL_IN',
                    committeeId: c.id,
                    stationLabel: `${c.hallName.toUpperCase()} · ${c.name}`,
                  })
                }
              />
              <Row
                label={`${c.hallName.toUpperCase()} · OUT`}
                onPress={() =>
                  onPick({
                    stationType: 'HALL_OUT',
                    committeeId: c.id,
                    stationLabel: `${c.hallName.toUpperCase()} · CHECK-OUT`,
                  })
                }
                last={i === (committees?.length ?? 0) - 1}
              />
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}

function Row({ label, onPress, last }: { label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Mono>{label}</Mono>
      {!last ? <Rule /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter, gap: 12 },
  body: { paddingHorizontal: layout.gutter, paddingTop: 18, paddingBottom: 12, gap: 14 },
  stationLabel: { ...type.label, fontSize: 15, color: ink.ink },
  breakNote: { ...type.label, fontSize: 11, color: ink.ash },
  footer: { paddingHorizontal: layout.gutter, paddingBottom: 12, gap: 8 },
  row: { gap: 12, paddingVertical: 13 },
  rowPressed: { opacity: 0.5 },
  hint: { ...type.body, fontSize: 13, color: ink.ash },
});
