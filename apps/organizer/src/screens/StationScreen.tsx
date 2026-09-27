/**
 * The station picker — the first screen after sign-in. An organizer works one
 * station at a time, so the flow is: pick station → scan → receipt → back.
 * The list is the live committee table plus the two conference directions and
 * the two meal services; nothing here is hardcoded per venue.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Eyebrow, ink, layout, Mono, Rule, Screen, type } from '@mianu/ui';
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

  useEffect(() => {
    api
      .committees()
      .then(({ committees: cs }) => setCommittees(cs))
      .catch(() => setError('Committee list unavailable. Check the connection.'));
  }, []);

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.stationLabel}>SELECT STATION</Text>
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
            <Row
              key={c.id}
              label={`${c.hallName.toUpperCase()} · ${c.name}`}
              onPress={() =>
                onPick({
                  stationType: 'HALL_IN',
                  committeeId: c.id,
                  stationLabel: `${c.hallName.toUpperCase()} · ${c.name}`,
                })
              }
              last={i === (committees?.length ?? 0) - 1}
            />
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
  row: { gap: 12, paddingVertical: 13 },
  rowPressed: { opacity: 0.5 },
  hint: { ...type.body, fontSize: 13, color: ink.ash },
});
