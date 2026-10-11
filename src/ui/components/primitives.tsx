import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { fonts, radius, spacing, typography, useTheme } from '../theme';
import { GradientBackground, lighten } from './visuals';

export function Screen({
  children,
  refreshing,
  onRefresh,
  testID,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      testID={testID}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.screenContent}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.textMuted} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
  testID,
  depth = 'default',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** `deep` is the hero treatment: heavier shadow, used once per screen. */
  depth?: 'default' | 'deep';
}) {
  const { colors, isDark } = useTheme();
  const shadow = isDark
    ? null
    : {
        shadowColor: colors.shadow,
        shadowOpacity: depth === 'deep' ? 0.16 : 0.08,
        shadowRadius: depth === 'deep' ? 22 : 12,
        shadowOffset: { width: 0, height: depth === 'deep' ? 8 : 3 },
      };
  return (
    <View
      testID={testID}
      style={[styles.card, shadow, { backgroundColor: colors.surface, borderColor: colors.rim }, style]}
    >
      <View pointerEvents="none" style={[styles.specular, { backgroundColor: colors.specular }]} />
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text accessibilityRole="header" style={[typography.overline, styles.sectionTitle, { color: colors.textMuted }]}>
      {children}
    </Text>
  );
}

/** Small tinted pill: `color` is the foreground, background and border are derived from it. */
export function Chip({ label, color, testID }: { label: string; color: string; testID?: string }) {
  return (
    <View testID={testID} style={[styles.chip, { backgroundColor: `${color}1c`, borderColor: `${color}44` }]}>
      <Text style={[typography.caption, styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  testID,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  const foreground = primary ? colors.onAccent : variant === 'destructive' ? colors.danger : colors.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { shadowColor: colors.accent, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }
          : { backgroundColor: colors.surfaceMuted, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.rim },
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
      ]}
    >
      {primary ? (
        <View style={styles.buttonFill} pointerEvents="none">
          <GradientBackground from={lighten(colors.accent, 0.14)} to={colors.accent} />
        </View>
      ) : null}
      <Text style={[typography.headline, styles.buttonLabel, { color: foreground }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenContent: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.md },
  card: { borderRadius: radius.xl, padding: spacing.xl, borderWidth: StyleSheet.hairlineWidth },
  specular: { position: 'absolute', top: 0, left: radius.xl, right: radius.xl, height: 1 },
  sectionTitle: { marginTop: spacing.lg, marginLeft: spacing.xs },
  chip: { alignSelf: 'flex-start', borderRadius: radius.pill, borderWidth: 0.5, paddingHorizontal: spacing.md, paddingVertical: 3 },
  chipText: { fontFamily: fonts.bodySemibold },
  button: {
    minHeight: 52,
    borderRadius: radius.button,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  buttonFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.button, overflow: 'hidden' },
  buttonLabel: { fontFamily: fonts.bodyBold, fontSize: 16 },
});
