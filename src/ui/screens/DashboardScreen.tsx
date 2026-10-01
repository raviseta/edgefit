import { StyleSheet, Text, View } from 'react-native';

import { hasAnyMetric } from '@/domain/models';
import { EMPTY_VALUE, formatDuration, formatEnergyValue, formatMetric, greeting } from '@/lib/format';
import type { ActivitySnapshot } from '@/services/ActivityService';
import { InsightCard, MetricCard, MetricGrid, ScoreCard } from '../components/ActivityCards';
import { Screen, SectionTitle } from '../components/primitives';
import { SnapshotNotices } from '../components/SnapshotNotices';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '../components/StateViews';
import { useActivitySnapshot } from '../hooks';
import { spacing, typography, useTheme } from '../theme';

export function DashboardScreen({ now = () => new Date() }: { now?: () => Date }) {
  const query = useActivitySnapshot();
  const { colors } = useTheme();

  if (query.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen testID="dashboard" refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <View style={styles.header}>
        <Text style={[typography.title, { color: colors.text }]}>{greeting(now())} 👋</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {now().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </View>
      {query.isError ? <ErrorState onRetry={() => query.refetch()} /> : <DashboardContent snapshot={query.data} />}
    </Screen>
  );
}

export function DashboardContent({ snapshot }: { snapshot: ActivitySnapshot }) {
  const { today, settings, insights } = snapshot;

  if (!settings.healthDataEnabled) {
    return <PermissionDeniedState />;
  }

  const isEmpty = !today || (!hasAnyMetric(today) && today.workoutCount === 0);
  // The empty state already says there's no data today; don't repeat it as an insight.
  const insight = insights.find((i) => !(isEmpty && i.type === 'no-activity-yet'));

  return (
    <>
      <SnapshotNotices snapshot={snapshot} />
      <SectionTitle>Today&apos;s Activity</SectionTitle>
      {isEmpty || !today ? (
        <EmptyState
          title="No activity data for today yet"
          message="EdgeFit hasn't received any steps, energy or exercise minutes for today. If you expected data, check that EdgeFit can read your data in the Health app → your profile → Apps → EdgeFit."
        />
      ) : (
        <>
          <MetricGrid>
            <MetricCard testID="metric-steps" label="Steps" value={formatMetric(today.steps)} />
            <MetricCard
              testID="metric-calories"
              label="Active Energy"
              value={formatEnergyValue(today.activeCalories, settings.energyUnit)}
              unit={settings.energyUnit}
            />
            <MetricCard
              testID="metric-minutes"
              label="Active Time"
              value={today.activeMinutes === null ? EMPTY_VALUE : formatDuration(today.activeMinutes)}
            />
            <MetricCard testID="metric-workouts" label="Workouts" value={String(today.workoutCount)} />
          </MetricGrid>
          <ScoreCard summary={today} />
        </>
      )}
      {insight ? <InsightCard insight={insight} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.xs, gap: 2 },
});
