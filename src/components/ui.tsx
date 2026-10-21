import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, TextInputProps, View, ViewStyle } from 'react-native';
import { Text, TextInput } from './Text';
import { colors } from './theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function H2({ children }: { children: ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        kind === 'secondary' && styles.buttonSecondary,
        kind === 'danger' && styles.buttonDanger,
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.8 },
      ]}
    >
      <Text style={[styles.buttonText, kind === 'secondary' && { color: colors.accentDark }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && { color: colors.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, suffix, ...props }: TextInputProps & { label: string; suffix?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: value > max && max > 0 ? colors.red : color }]} />
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

export function Wrap({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>{children}</View>;
}

export const n0 = (v: number) => Math.round(v).toLocaleString('en-IN');
export const n1 = (v: number) => (Math.round(v * 10) / 10).toString();

/** Parses a decimal typed by the user ("62.5" or "62,5"); NaN when empty or invalid. */
export const parseNum = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')));

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.line },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: colors.text, marginBottom: 4 },
  h2: { fontSize: 17, lineHeight: 23, fontWeight: '700', color: colors.text, marginBottom: 8 },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  button: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', marginBottom: 10 },
  buttonSecondary: { backgroundColor: colors.soft },
  buttonDanger: { backgroundColor: colors.red },
  buttonText: { color: colors.onAccent, fontWeight: '700', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.soft },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 13, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.inputBg },
  input: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, color: colors.text },
  suffix: { paddingRight: 12, color: colors.muted },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
});
