import { StyleSheet, Text, View } from 'react-native';

import { toDateKey } from '@/domain/dates';
import type { EnergyUnit, Workout } from '@/domain/models';
import { formatDayLabel, formatDuration, formatEnergy, formatTime } from '@/lib/format';
import type { ActivitySnapshot } from '@/services/ActivityService';
import { WORKOUT_SYNC_DAYS } from '@/services/SyncService';
import { Card, Screen, SectionTitle } from '../components/primitives';
import { IconChip, type IconName } from '../components/visuals';
import { SnapshotNotices } from '../components/SnapshotNotices';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '../components/StateViews';
import { useActivitySnapshot } from '../hooks';
import { spacing, typography, useTheme } from '../theme';

export function WorkoutsScreen({ now = () => new Date() }: { now?: () => Date }) {
  const query = useActivitySnapshot();
  if (query.isPending) {
    return (
      <Screen>
        <LoadingState label="Loading workouts…" />
      </Screen>
    );
  }
  return (
    <Screen testID="workouts" refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      {query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <WorkoutsContent snapshot={query.data} now={now()} />
      )}
    </Screen>
  );
}

export function WorkoutsContent({ snapshot, now }: { snapshot: ActivitySnapshot; now: Date }) {
  const { workouts, settings } = snapshot;
  if (!settings.healthDataEnabled) return <PermissionDeniedState />;

  return (
    <>
      <SnapshotNotices snapshot={snapshot} />
      {workouts.length === 0 ? (
        <EmptyState
          title="No workouts yet"
          message={`Workouts recorded in Health over the last ${WORKOUT_SYNC_DAYS} days will appear here. EdgeFit reads workouts; it doesn't record them.`}
        />
      ) : (
        <>
          <SectionTitle>Last {WORKOUT_SYNC_DAYS} days</SectionTitle>
          <Card style={styles.listCard}>
            {workouts.map((w, i) => (
              <WorkoutRow key={w.id} workout={w} now={now} unit={settings.energyUnit} first={i === 0} />
            ))}
          </Card>
        </>
      )}
    </>
  );
}

function workoutIcon(type: string): IconName {
  const t = type.toLowerCase();
  if (t.includes('cycl') || t.includes('bik')) return 'bike';
  if (t.includes('strength') || t.includes('weight') || t.includes('training')) return 'dumbbell';
  if (t.includes('walk') || t.includes('hik')) return 'steps';
  return 'pulse';
}

export function WorkoutRow({ workout, now, unit, first }: { workout: Workout; now: Date; unit: EnergyUnit; first: boolean }) {
  const { colors } = useTheme();
  const start = new Date(workout.startDate);
  const details = [formatDuration(workout.durationMinutes)];
  if (workout.calories !== undefined) details.push(formatEnergy(workout.calories, unit));
  return (
    <View
      testID={`workout-${workout.id}`}
      style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
    >
      <IconChip name={workoutIcon(workout.type)} color={colors.metricWorkouts} background={colors.metricWorkoutsSoft} size={44} />
      <View style={styles.rowText}>
        <Text style={[typography.headline, { color: colors.text }]}>{workout.type}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {formatDayLabel(toDateKey(start), now)} · {formatTime(start)}
        </Text>
        <Text style={[typography.body, { color: colors.text }]}>{details.join(' · ')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listCard: { paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  rowText: { flex: 1, gap: 2 },
});
