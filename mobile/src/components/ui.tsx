import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export { Ionicons };

// ---------- Layout ----------
export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
}) {
  const inner = <View style={[styles.content, contentStyle]}>{children}</View>;
  return (
    <View style={styles.screen}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}>
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
      {footer ? (
        <View style={styles.footer}>
          <View style={styles.footerInner}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style, gap = Spacing.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </Row>
  );
}

// ---------- Text ----------
export function T({
  children,
  variant = 'body',
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'muted' | 'small' | 'label' | 'price';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text style={[textStyles[variant], style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

// ---------- Controls ----------
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  size = 'md',
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md';
}) {
  const v = buttonVariants[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && { opacity: 0.85 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={v.fg} /> : null}
          <Text style={[styles.buttonText, size === 'sm' && { fontSize: 14 }, { color: v.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const buttonVariants: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: Colors.primary, fg: Colors.white, border: Colors.primary },
  secondary: { bg: Colors.primarySoft, fg: Colors.primaryDark, border: Colors.primarySoft },
  outline: { bg: Colors.white, fg: Colors.text, border: Colors.border },
  danger: { bg: Colors.dangerSoft, fg: Colors.danger, border: Colors.dangerSoft },
  ghost: { bg: 'transparent', fg: Colors.primaryDark, border: 'transparent' },
};

export function Field({
  label,
  error,
  hint,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string | null; hint?: string }) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      {label ? <Text style={textStyles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#98A2B3"
        {...props}
        style={[styles.input, props.multiline && { minHeight: 88, textAlignVertical: 'top' }, error ? { borderColor: Colors.danger } : null, style]}
      />
      {error ? <Text style={[textStyles.small, { color: Colors.danger, marginTop: 4 }]}>{error}</Text> : null}
      {hint && !error ? <Text style={[textStyles.small, { marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}>
      {icon ? <Ionicons name={icon} size={14} color={selected ? Colors.white : Colors.textMuted} /> : null}
      <Text style={[styles.chipText, selected && { color: Colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function QuantityStepper({
  value,
  onChange,
  max = 100,
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
}) {
  return (
    <Row gap={0} style={styles.stepper}>
      <Pressable accessibilityLabel="Decrease quantity" style={styles.stepBtn} onPress={() => onChange(value - 1)}>
        <Ionicons name={value <= 1 ? 'trash-outline' : 'remove'} size={18} color={Colors.text} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        accessibilityLabel="Increase quantity"
        style={[styles.stepBtn, value >= max && { opacity: 0.35 }]}
        disabled={value >= max}
        onPress={() => onChange(value + 1)}>
        <Ionicons name="add" size={18} color={Colors.text} />
      </Pressable>
    </Row>
  );
}

// ---------- Feedback ----------
type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
const toneColors: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: Colors.primarySoft, fg: Colors.primaryDark },
  warning: { bg: Colors.warningSoft, fg: Colors.warning },
  danger: { bg: Colors.dangerSoft, fg: Colors.danger },
  info: { bg: Colors.infoSoft, fg: Colors.info },
  neutral: { bg: '#EEF1F4', fg: Colors.textMuted },
};

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={c.fg} /> : null}
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function Notice({
  tone = 'info',
  icon = 'information-circle',
  title,
  children,
}: {
  tone?: Tone;
  icon?: IconName;
  title?: string;
  children?: ReactNode;
}) {
  const c = toneColors[tone];
  return (
    <View style={[styles.notice, { backgroundColor: c.bg }]}>
      <Ionicons name={icon} size={20} color={c.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        {title ? <Text style={[styles.noticeTitle, { color: c.fg }]}>{title}</Text> : null}
        {typeof children === 'string' ? <Text style={[textStyles.small, { color: c.fg }]}>{children}</Text> : children}
      </View>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Colors.primary} />
      {label ? <T variant="muted" style={{ marginTop: Spacing.md }}>{label}</T> : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={36} color={Colors.primary} />
      </View>
      <T variant="h3" style={{ textAlign: 'center' }}>{title}</T>
      {message ? <T variant="muted" style={{ textAlign: 'center', marginTop: Spacing.xs, maxWidth: 320 }}>{message}</T> : null}
      {action ? <View style={{ marginTop: Spacing.lg }}>{action}</View> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Something went wrong"
      message={message}
      action={onRetry ? <Button title="Try again" icon="refresh" onPress={onRetry} variant="outline" /> : undefined}
    />
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md }} />;
}

export function KeyValue({ label, value, bold }: { label: string; value: ReactNode; bold?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
      <T variant={bold ? 'h3' : 'muted'}>{label}</T>
      {typeof value === 'string' ? <T variant={bold ? 'h3' : 'body'}>{value}</T> : value}
    </Row>
  );
}

// ---------- Styles ----------
export const textStyles = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700', color: Colors.text },
  h3: { fontSize: 16, fontWeight: '700', color: Colors.text },
  body: { fontSize: 15, color: Colors.text, lineHeight: 21 },
  muted: { fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
  small: { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  price: { fontSize: 16, fontWeight: '800', color: Colors.primaryDark },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.lg, flexGrow: 1, alignSelf: 'center' },
  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
    padding: Spacing.md,
    alignItems: 'center',
  },
  footerInner: { width: '100%', maxWidth: MaxContentWidth },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  button: {
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  buttonSm: { minHeight: 36, paddingHorizontal: Spacing.md, borderRadius: Radius.sm },
  buttonText: { fontSize: 16, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: Colors.white,
    color: Colors.text,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  chipText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  stepper: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.white },
  stepBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: '700', color: Colors.text },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  notice: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  noticeTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, minHeight: 300 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
});
