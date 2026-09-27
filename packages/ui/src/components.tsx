/**
 * Shared monochrome primitives. Used by the organizer and IT admin apps so
 * both ships of the design are literally the same components.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ink, layout, type } from './theme';

/** A hairline card — the basic surface of every screen. */
export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Section eyebrow: "STATION", "PARTICIPANT", "BALANCE". */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={[styles.eyebrow]}>{children}</Text>;
}

/**
 * Screen shell: applies safe-area padding top (Dynamic Island / notch) and
 * bottom (home indicator) on every device, and — when `scroll` is set — a
 * ScrollView body that keeps forms reachable above the keyboard
 * (`keyboardShouldPersistTaps` so the Sign in button takes the tap instead
 * of the first tap being eaten by keyboard dismissal).
 */
export function Screen({
  children,
  scroll,
  footer,
  invert,
}: {
  children: React.ReactNode;
  /** scroll the body — use on every screen with a form or a list */
  scroll?: boolean;
  /** pinned bottom slot (primary action), outside the scroll body */
  footer?: React.ReactNode;
  invert?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) },
        invert && styles.screenInvert,
      ]}
    >
      <View style={styles.stage}>{scroll ? <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView> : children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
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
  screen: { flex: 1, backgroundColor: ink.paper },
  screenInvert: { backgroundColor: ink.ink },
  stage: { flex: 1 },
  footer: { paddingHorizontal: layout.gutter, paddingTop: 10 },
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
  actionText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
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
