import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { spacing, typography, useTheme } from '../theme';
import { Button, Card } from './primitives';

/**
 * Inside a screen, render this within <Screen> so the native large-title header
 * stays attached to the same ScrollView across loading → loaded. `fullScreen`
 * is for app start-up, before any navigator exists.
 */
export function LoadingState({ label = 'Loading your activity…', fullScreen }: { label?: string; fullScreen?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      testID="state-loading"
      style={fullScreen ? [styles.center, { backgroundColor: colors.background }] : styles.inline}
    >
      <ActivityIndicator color={colors.textMuted} />
      <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.md }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  message,
  actionTitle,
  onAction,
  testID = 'state-empty',
}: {
  title: string;
  message: string;
  actionTitle?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Card testID={testID} style={styles.stateCard}>
      <Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[typography.body, styles.message, { color: colors.textMuted }]}>{message}</Text>
      {actionTitle && onAction ? <Button title={actionTitle} onPress={onAction} variant="secondary" /> : null}
    </Card>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message = "EdgeFit couldn't read its local data. Your health data in the Health app is not affected.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState testID="state-error" title={title} message={message} actionTitle="Try again" onAction={onRetry} />
  );
}

export function PermissionDeniedState() {
  return (
    <EmptyState
      testID="state-permission-denied"
      title="Health data access is currently unavailable."
      message="You can enable access later from Settings."
      actionTitle="Open Settings"
      onAction={() => router.navigate('/settings')}
    />
  );
}

export function Banner({ message, tone = 'info', testID }: { message: string; tone?: 'info' | 'warning'; testID?: string }) {
  const { colors } = useTheme();
  const background = tone === 'warning' ? colors.warningMuted : colors.accentMuted;
  const foreground = tone === 'warning' ? colors.warning : colors.text;
  return (
    <View testID={testID} accessibilityRole="alert" style={[styles.banner, { backgroundColor: background }]}>
      <Text style={[typography.caption, { color: foreground }]}>{message}</Text>
    </View>
  );
}

export function DemoDataBanner() {
  return (
    <Banner
      testID="banner-demo-data"
      message="Demo data — EdgeFit is showing built-in sample activity, not data from Apple Health. No real health data is being read."
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  inline: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
  stateCard: { gap: spacing.md },
  message: { marginTop: -spacing.xs },
  banner: { borderRadius: 10, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
});
