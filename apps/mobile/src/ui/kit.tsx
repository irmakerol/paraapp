import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from './theme';

export function Button({
  label,
  onPress,
  kind = 'primary',
  busy = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const bg = kind === 'primary' ? c.primary : kind === 'danger' ? c.danger : c.card;
  const fg = kind === 'secondary' ? c.text : c.primaryText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: c.border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const c = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const c = useTheme();
  return <Text style={[styles.body, { color: muted ? c.muted : c.text }]}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}

export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={styles.toggle}
    >
      <Text style={[styles.body, { color: c.text, flex: 1 }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </Pressable>
  );
}

/** A value with − and + buttons (big targets, usable with gloves). */
export function Stepper({
  label,
  value,
  onStep,
  canDown,
  canUp,
  help,
}: {
  label: string;
  value: string;
  onStep: (direction: 1 | -1) => void;
  canDown: boolean;
  canUp: boolean;
  help?: string;
}) {
  const c = useTheme();
  const button = (direction: 1 | -1, enabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${direction > 0 ? '+' : '−'}`}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={() => onStep(direction)}
      style={({ pressed }) => [
        styles.stepButton,
        {
          borderColor: c.border,
          backgroundColor: c.bg,
          opacity: !enabled ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[styles.stepSign, { color: c.text }]}>{direction > 0 ? '+' : '−'}</Text>
    </Pressable>
  );
  return (
    <View style={styles.setting} accessibilityLabel={`${label}: ${value}`}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.body, { color: c.text, fontWeight: '600' }]}>{label}</Text>
        {help ? <Text style={[styles.help, { color: c.muted }]}>{help}</Text> : null}
      </View>
      {button(-1, canDown)}
      <Text style={[styles.stepValue, { color: c.text }]}>{value}</Text>
      {button(1, canUp)}
    </View>
  );
}

/** One choice out of a few, shown side by side. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  help,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  help?: string;
}) {
  const c = useTheme();
  return (
    <View style={{ marginVertical: 8 }}>
      <Text style={[styles.body, { color: c.text, fontWeight: '600' }]}>{label}</Text>
      {help ? <Text style={[styles.help, { color: c.muted }]}>{help}</Text> : null}
      <View
        accessibilityRole="radiogroup"
        style={[styles.segments, { borderColor: c.border, backgroundColor: c.bg }]}
      >
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={o.label}
              onPress={() => onChange(o.value)}
              style={[styles.segment, on && { backgroundColor: c.primary }]}
            >
              <Text style={[styles.segmentText, { color: on ? c.primaryText : c.text }]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Link({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.link}>
      <Text style={[styles.body, { color: c.primary, textDecorationLine: 'underline' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginVertical: 6,
  },
  buttonText: { fontSize: 17, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 16, lineHeight: 22 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginVertical: 8 },
  toggle: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  link: { minHeight: 44, justifyContent: 'center' },
  help: { fontSize: 14, lineHeight: 19, marginTop: 2 },
  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    marginVertical: 6,
  },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSign: { fontSize: 26, fontWeight: '600' },
  stepValue: {
    minWidth: 64,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  segments: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    marginTop: 8,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontSize: 15, fontWeight: '600' },
});
