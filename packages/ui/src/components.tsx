/**
 * Shared monochrome primitives. Used by the organizer and IT admin apps so
 * both ships of the design are literally the same components.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ink, layout, radii, type } from './theme';

type PressableProps = React.ComponentProps<typeof Pressable>;

/** A hairline card — the basic surface of every screen. */
export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Section eyebrow: "STATION", "PARTICIPANT", "BALANCE". */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={[styles.eyebrow]}>{children}</Text>;
}

/**
 * The primary action. Solid black, white type, full-width, bottom-anchored.
 * The one thing on the screen you are meant to hit.
 */
export function Action({
  label,
  onPress,
  disabled,
  invert,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** white box / black type — used for the secondary escape hatch */
  invert?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        invert ? styles.actionInvert : styles.actionSolid,
        disabled && styles.actionDisabled,
        pressed && !disabled && styles.actionPressed,
      ]}
    >
      <Text
        style={[styles.actionText, invert ? styles.textInvert : styles.textSolid, disabled && styles.textDisabled]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Low-weight secondary link ("Type code instead"). It is deliberately small so
 * the primary NFC action stays visually dominant.
 */
export function GhostLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => pressed && styles.linkPressed}
    >
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

/** Monospaced data line: codes, refs, times. */
export function Mono({ children, invert }: { children: React.ReactNode; invert?: boolean }) {
  return <Text style={[styles.mono, invert && styles.monoInvert]}>{children}</Text>;
}

/** A single-rule divider. */
export function Rule({ invert }: { invert?: boolean }) {
  return <View style={[styles.rule, invert && styles.ruleInvert]} />;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: layout.hair,
    borderColor: ink.rule,
    backgroundColor: ink.paper,
    padding: layout.pad,
  },
  eyebrow: { ...type.label, color: ink.ash, marginBottom: 6 },
  action: {
    minHeight: layout.touch,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
  },
  actionSolid: { backgroundColor: ink.ink },
  actionInvert: {
    backgroundColor: ink.paper,
    borderWidth: layout.hair,
    borderColor: ink.rule,
  },
  actionPressed: { opacity: 0.8 },
  actionDisabled: { backgroundColor: ink.smoke },
  actionText: { fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  textSolid: { color: ink.paper },
  textInvert: { color: ink.ink },
  textDisabled: { color: ink.ash },
  link: { ...type.body, color: ink.ink, textDecorationLine: 'underline', fontWeight: '600' },
  linkPressed: { opacity: 0.5 },
  mono: { ...type.mono, color: ink.ink },
  monoInvert: { color: ink.inverse },
  rule: { height: layout.hair, backgroundColor: ink.rule },
  ruleInvert: { backgroundColor: ink.inverse },
});
