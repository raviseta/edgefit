import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, typography, useTheme } from '../theme';

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

export function Card({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { colors, isDark } = useTheme();
  const depth = isDark
    ? { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }
    : { shadowColor: colors.shadow, shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } };
  return (
    <View testID={testID} style={[styles.card, depth, { backgroundColor: colors.surface }, style]}>
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
  const background = variant === 'primary' ? colors.accent : colors.surfaceMuted;
  const foreground = variant === 'primary' ? colors.onAccent : variant === 'destructive' ? colors.danger : colors.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[typography.headline, { color: foreground }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenContent: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.md },
  card: { borderRadius: radius.xl, padding: spacing.lg },
  sectionTitle: { marginTop: spacing.lg, marginLeft: spacing.xs },
  button: {
    minHeight: 50,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
