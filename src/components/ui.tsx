import { router } from 'expo-router';
import { Children, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { column, sheetPanel } from '@/lib/responsive';
import { C, F, shadow, tintOf } from '@/theme';

import { Icon, type IconName } from './Icon';

// ------------------------------------------------------------------ text
type W = 400 | 600 | 700 | 800 | 900;
const WEIGHT: Record<W, string> = { 400: F.regular, 600: F.semibold, 700: F.bold, 800: F.extrabold, 900: F.black };

export function T({ w = 400, size = 15, color = C.ink, style, ...rest }: TextProps & { w?: W; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text {...rest} style={[{ fontFamily: WEIGHT[w], fontSize: size, color, lineHeight: Math.round(size * 1.38) }, style]} />;
}

// ------------------------------------------------------------------ layout
export function Screen({ children, edges = [], style }: { children: ReactNode; edges?: Edge[]; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: C.bg }, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Scroll({ children, style, pad = true, bottom = 28 }: { children: ReactNode; style?: StyleProp<ViewStyle>; pad?: boolean; bottom?: number }) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[column, pad && { paddingHorizontal: 20 }, { paddingTop: 4, paddingBottom: bottom }, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

/** Colored "game" header: navy band with a dot pattern that runs behind the status bar. */
export function Header({
  title, sub, back = true, onBack, right, children, color = C.navy, kicker,
}: { title: string; sub?: string; back?: boolean; onBack?: () => void; right?: ReactNode; children?: ReactNode; color?: string; kicker?: string }) {
  const insets = useSafeAreaInsets();
  const compact = useWindowDimensions().width < 360;
  return (
    <View style={[s.gameHdr, { backgroundColor: color, paddingTop: insets.top + 8 }]}>
      <HeaderDecor />
      <View style={column}>
      <View style={s.hdr}>
        {back && (
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={6}
            onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/home')))} style={s.backBtn}>
            <Icon name="left" color="#fff" />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          {kicker ? <T w={900} size={12} color="#FDE68A" style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>{kicker}</T> : null}
          {/* Narrow phones: smaller title that may wrap to 2 lines instead of being cut off. */}
          <T w={900} size={compact ? 19 : 22} color="#fff" numberOfLines={compact ? 2 : 1}>{title}</T>
          {sub ? <T w={700} size={13.5} color="#BFDBFE" numberOfLines={2}>{sub}</T> : null}
        </View>
        {right}
      </View>
      {children}
      </View>
    </View>
  );
}

/** Soft circles + dots used behind colored headers. Decorative only. */
export function HeaderDecor() {
  // Enough dot columns to cover the band on any screen width (capped so desktop stays light).
  const cols = Math.min(40, Math.ceil(useWindowDimensions().width / 34));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
      <View style={{ position: 'absolute', right: -70, top: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.07)' }} />
      <View style={{ position: 'absolute', left: -40, bottom: -60, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' }} />
      {Array.from({ length: cols * 5 }, (_, i) => (
        <View key={i} style={{ position: 'absolute', left: (i % cols) * 34 + 10, top: Math.floor(i / cols) * 34 + 12, width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.13)' }} />
      ))}
    </View>
  );
}

/** Progress bar of a multi-step flow, for colored headers. */
export function StepBar({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 14 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 8, borderRadius: 99, backgroundColor: i < step ? '#FBBF24' : 'rgba(255,255,255,0.2)' }} />
      ))}
    </View>
  );
}

/** Small pill shown on colored headers (streak, stars, level). */
export function HeaderChip({ children, gold }: { children: ReactNode; gold?: boolean }) {
  return <View style={[s.hChip, gold && { backgroundColor: '#FBBF24' }]}>{children}</View>;
}

export function Footer({ children, row }: { children: ReactNode; row?: boolean }) {
  return (
    <View style={s.footer}>
      <View style={[column, row && { flexDirection: 'row', gap: 10 }]}>{children}</View>
    </View>
  );
}

export function Card({ children, style, onPress, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
  if (onPress)
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  return <View style={[s.card, style]}>{children}</View>;
}

export function Section({ title, action, children, style }: { title: string; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: 26 }, style]}>
      <View style={s.secH}>
        <T w={900} size={17}>{title}</T>
        {action}
      </View>
      {children}
    </View>
  );
}

export function GroupLabel({ children }: { children: string }) {
  return <T w={900} size={13} color={C.muted} style={{ textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 24, marginBottom: 10, marginHorizontal: 4 }}>{children}</T>;
}

// ------------------------------------------------------------------ controls
type BtnVariant = 'primary' | 'soft' | 'ghost' | 'white' | 'danger' | 'success' | 'gold';
// Game-style buttons: a darker "edge" under each button makes it look pressable.
const BTN: Record<BtnVariant, { bg: string; fg: string; edge: string; border?: string }> = {
  primary: { bg: C.primary, fg: '#fff', edge: C.navy },
  soft: { bg: C.primary50, fg: C.primary700, edge: '#BFDBFE' },
  ghost: { bg: C.surface, fg: C.primary700, edge: C.line, border: C.line },
  white: { bg: '#fff', fg: C.navy, edge: '#BFDBFE' },
  danger: { bg: C.danger, fg: '#fff', edge: '#991B1B' },
  success: { bg: '#22C55E', fg: '#fff', edge: '#15803D' },
  gold: { bg: '#FBBF24', fg: '#422006', edge: '#B45309' },
};

export function Btn({
  title, onPress, variant = 'primary', icon, loading, disabled, small, style, textColor,
}: { title: string; onPress?: () => void; variant?: BtnVariant; icon?: IconName; loading?: boolean; disabled?: boolean; small?: boolean; style?: StyleProp<ViewStyle>; textColor?: string }) {
  const v = BTN[variant];
  const off = disabled || loading;
  const fg = textColor ?? (off && variant === 'primary' ? '#fff' : v.fg);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSm,
        { backgroundColor: off && variant === 'primary' ? '#CBD5E1' : v.bg, borderBottomWidth: pressed ? 2 : 5, borderBottomColor: off ? '#94A3B8' : v.edge },
        v.border && { borderWidth: 2, borderColor: v.border, borderBottomColor: v.edge },
        pressed && { transform: [{ translateY: 3 }] },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={small ? 18 : 20} color={fg} strokeWidth={2.4} /> : null}
      <T w={900} size={small ? 14.5 : 16} color={fg} style={{ textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center', flexShrink: 1 }}>{title}</T>
    </Pressable>
  );
}

export function IconBtn({ icon, label, onPress, flat, badge, color }: { icon: IconName; label: string; onPress?: () => void; flat?: boolean; badge?: number; color?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={({ pressed }) => [s.iconBtn, flat ? { backgroundColor: 'transparent' } : shadow, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} color={color ?? (flat ? C.muted : C.ink)} />
      {badge ? (
        <View style={s.badge}>
          <T w={900} size={11} color="#fff">{badge}</T>
        </View>
      ) : null}
    </Pressable>
  );
}

export function LinkText({ title, onPress, icon }: { title: string; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {icon && <Icon name={icon} size={18} color={C.primary700} />}
      <T w={800} color={C.primary700}>{title}</T>
    </Pressable>
  );
}

export function Field({
  label, icon, optional, hint, error, secure, grow, ...input
}: TextInputProps & { label: string; icon?: IconName; optional?: boolean; hint?: string; error?: string | null; secure?: boolean; /** Wraps long text onto more lines instead of scrolling sideways. */ grow?: boolean }) {
  const [show, setShow] = useState(false);
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <T w={800} size={14.5} color={C.ink2}>
        {label}
        {optional ? <T w={700} size={14.5} color={C.muted}> (Optional)</T> : null}
      </T>
      <View style={[s.input, focus && { borderColor: C.primary }, !!error && { borderColor: C.danger }]}>
        {icon && <Icon name={icon} color={C.muted} />}
        <TextInput
          {...input}
          multiline={grow || input.multiline}
          submitBehavior={grow ? 'blurAndSubmit' : input.submitBehavior}
          accessibilityLabel={label}
          secureTextEntry={secure && !show}
          placeholderTextColor={C.faint}
          onFocus={(e) => { setFocus(true); input.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); input.onBlur?.(e); }}
          style={[s.inputText, input.multiline && { minHeight: 120, textAlignVertical: 'top', paddingVertical: 12 }, grow && { textAlignVertical: 'center', paddingVertical: 14 }]}
        />
        {secure && (
          <Pressable accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'} onPress={() => setShow(!show)} hitSlop={8} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            <Icon name="eye" size={18} color={C.primary700} />
            <T w={800} size={14} color={C.primary700}>{show ? 'Hide' : 'Show'}</T>
          </Pressable>
        )}
      </View>
      {error ? <T size={13} color={C.danger} w={700}>{error}</T> : hint ? <T size={13} color={C.muted}>{hint}</T> : null}
    </View>
  );
}

export function Chip({ title, on, onPress, icon, style }: { title: string; on?: boolean; onPress?: () => void; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      onPress={onPress}
      style={[s.chip, on && { borderColor: C.primary, backgroundColor: C.primary50 }, style]}>
      {icon && <Icon name={icon} size={16} color={on ? C.primary700 : C.ink2} strokeWidth={2.6} />}
      <T w={800} size={14.5} color={on ? C.primary700 : C.ink2}>{title}</T>
    </Pressable>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} onPress={() => onChange(!value)} hitSlop={8} style={[s.toggle, value && { backgroundColor: C.success }]}>
      <View style={[s.knob, { left: value ? 23 : 3 }]} />
    </Pressable>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
      <View style={[s.cbox, checked && { backgroundColor: C.primary, borderColor: C.primary }]}>{checked && <Icon name="check" size={16} color="#fff" strokeWidth={3.2} />}</View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

// ------------------------------------------------------------------ display
export function Tile({ icon, tint = 'blue', size = 44 }: { icon: IconName; tint?: string; size?: number }) {
  const t = tintOf(tint);
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} color={t.fg} size={size > 46 ? 24 : 22} />
    </View>
  );
}

export function Pill({ text, tone = 'blue', icon }: { text: string; tone?: 'blue' | 'green' | 'amber' | 'red' | 'gray'; icon?: IconName }) {
  const map = { blue: ['#DBEAFE', '#1D4ED8'], green: [C.success50, '#15803D'], amber: ['#FEF3C7', '#B45309'], red: [C.danger50, '#B91C1C'], gray: ['#EEF2F7', C.ink2] } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 10, borderRadius: 99, backgroundColor: bg, alignSelf: 'flex-start' }}>
      {icon && <Icon name={icon} size={14} color={fg} strokeWidth={2.5} />}
      <T w={800} size={12.5} color={fg}>{text}</T>
    </View>
  );
}

export function Progress({ value, light, height = 8, style }: { value: number; light?: boolean; height?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height, borderRadius: 99, backgroundColor: light ? 'rgba(255,255,255,.25)' : C.line, overflow: 'hidden', flex: 1 }, style]}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', borderRadius: 99, backgroundColor: light ? '#fff' : C.primary }} />
    </View>
  );
}

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
      <Tile icon={icon} tint="blue" size={52} />
      <T w={900} size={17} style={{ textAlign: 'center' }}>{title}</T>
      <T color={C.muted} style={{ textAlign: 'center' }}>{text}</T>
      {action}
    </Card>
  );
}

/**
 * Equal-width grid: `columns` items per row with exact gaps, so rows never wrap early
 * (percent widths plus gaps can add up to more than 100% on small phones).
 */
export function Grid({ columns, gap = 10, children, style }: { columns: number; gap?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [width, setWidth] = useState(0);
  const item = width ? (width - gap * (columns - 1)) / columns : 0;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={[{ flexDirection: 'row', flexWrap: 'wrap', gap }, style]}>
      {width > 0 && Children.toArray(children).map((child, i) => <View key={i} style={{ width: item }}>{child}</View>)}
    </View>
  );
}

/** Bottom sheet with a dimmed backdrop. Tapping outside or the back button calls onClose. */
export function Sheet({ visible, onClose, title, children, footer }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(15,23,42,.45)' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[sheetPanel, { maxHeight: '90%' }]}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: footer ? 8 : 24 + insets.bottom }} keyboardShouldPersistTaps="handled">
          <View style={{ width: 40, height: 5, borderRadius: 9, backgroundColor: '#CBD5E1', alignSelf: 'center' }} />
          {title ? <T w={900} size={21}>{title}</T> : null}
          {children}
        </ScrollView>
        {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 + insets.bottom, gap: 10 }}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
      <ActivityIndicator color={C.primary} size="large" />
    </View>
  );
}

export const s = StyleSheet.create({
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, minHeight: 50 },
  gameHdr: { paddingBottom: 18, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden', marginBottom: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  hChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, height: 32, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.14)' },
  footer: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line },
  card: { backgroundColor: C.surface, borderRadius: 22, padding: 16, borderBottomWidth: 3, borderBottomColor: C.line, ...shadow },
  secH: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, paddingHorizontal: 18, borderRadius: 16 },
  btnSm: { minHeight: 44, borderRadius: 12, paddingHorizontal: 14 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 99, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg },
  input: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderWidth: 2, borderColor: C.line, borderRadius: 16, backgroundColor: C.surface, paddingHorizontal: 14 },
  inputText: { flex: 1, fontFamily: F.semibold, fontSize: 15.5, color: C.ink, paddingVertical: 10 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 2, borderColor: C.line, backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  toggle: { width: 52, height: 32, borderRadius: 99, backgroundColor: '#CBD5E1', justifyContent: 'center' },
  knob: { position: 'absolute', top: 3, width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', ...shadow },
  cbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
