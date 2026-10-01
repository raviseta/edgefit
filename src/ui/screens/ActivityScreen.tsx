import { StyleSheet, Text, View } from 'react-native';

import { hasAnyMetric, type DailySummary } from '@/domain/models';
import { formatDayLabel, formatEnergy, formatMetric, formatNumber, formatWeekday, EMPTY_VALUE } from '@/lib/format';
import type { ActivitySnapshot, HistoryDay } from '@/services/ActivityService';
import { InsightCard } from '../components/ActivityCards';
import { BarChart } from '../components/BarChart';
import { Card, Screen, SectionTitle } from '../components/primitives';
import { SnapshotNotices } from '../components/SnapshotNotices';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '../components/StateViews';
import { useActivitySnapshot } from '../hooks';
import { spacing, typography, useTheme } from '../theme';

export function ActivityScreen({ now = () => new Date() }: { now?: () => Date }) {
  const query = useActivitySnapshot();
  if (query.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  return (
    <Screen testID="activity" refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      {query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <ActivityContent snapshot={query.data} now={now()} />
      )}
    </Screen>
  );
}

export function ActivityContent({ snapshot, now }: { snapshot: ActivitySnapshot; now: Date }) {
  const { history, settings, insights } = snapshot;

  if (!settings.healthDataEnabled) return <PermissionDeniedState />;

  const daysWithData = history.filter((d) => d.summary && dayHasData(d.summary));
  const stepValues = history.map((d) => d.summary?.steps ?? null).filter((v): v is number => v !== null);
  // An "average" of one day is meaningless; label it with the real number of days it covers.
  const avgSteps = stepValues.length >= 2 ? stepValues.reduce((a, b) => a + b, 0) / stepValues.length : null;
  const avgLabel = stepValues.length === history.length ? '7-day average' : `Average of ${stepValues.length} days with data`;
  const todayKey = history[history.length - 1]?.date;

  return (
    <>
      <SnapshotNotices snapshot={snapshot} />
      {daysWithData.length === 0 ? (
        <EmptyState
          title="No activity in the last 7 days"
          message="When Health has steps, energy or exercise minutes for the past week, your daily history and trends will appear here."
        />
      ) : (
        <>
          <SectionTitle>Steps · last 7 days</SectionTitle>
          <Card>
            <BarChart
              testID="chart-steps"
              title="Steps over the last 7 days"
              data={history.map((d) => ({
                key: d.date,
                label: formatWeekday(d.date),
                value: d.summary?.steps ?? null,
                highlight: d.date === todayKey,
              }))}
              formatValue={formatNumber}
              referenceValue={avgSteps}
              referenceLabel={avgLabel}
            />
          </Card>

          <SectionTitle>Activity Score trend</SectionTitle>
          <Card>
            <BarChart
              testID="chart-score"
              title="Activity score over the last 7 days"
              maxValue={100}
              data={history.map((d) => ({
                key: d.date,
                label: formatWeekday(d.date),
                value: d.summary?.activityScore ?? null,
                highlight: d.date === todayKey,
              }))}
              formatValue={(v) => `${v}`}
            />
          </Card>
        </>
      )}

      {insights.length > 0 ? <SectionTitle>Insights</SectionTitle> : null}
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}

      <SectionTitle>Daily breakdown</SectionTitle>
      <Card style={styles.listCard}>
        {[...history].reverse().map((day, index) => (
          <DayRow key={day.date} day={day} now={now} unit={settings.energyUnit} first={index === 0} />
        ))}
      </Card>
    </>
  );
}

function DayRow({
  day,
  now,
  unit,
  first,
}: {
  day: HistoryDay;
  now: Date;
  unit: ActivitySnapshot['settings']['energyUnit'];
  first: boolean;
}) {
  const { colors } = useTheme();
  const s = day.summary;
  const hasData = s !== null && dayHasData(s);
  return (
    <View
      testID={`day-${day.date}`}
      style={[styles.dayRow, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
    >
      <View style={styles.dayMain}>
        <Text style={[typography.headline, { color: colors.text }]}>{formatDayLabel(day.date, now)}</Text>
        {hasData ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {formatMetric(s.steps)} steps · {formatEnergy(s.activeCalories, unit)} ·{' '}
            {s.activeMinutes === null ? EMPTY_VALUE : `${s.activeMinutes} min`}
          </Text>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted }]}>No data</Text>
        )}
      </View>
      <View
        style={styles.scoreBadge}
        accessible
        accessibilityLabel={s?.activityScore != null ? `Score ${s.activityScore}` : 'No score'}
      >
        <Text style={[typography.headline, { color: s?.activityScore != null ? colors.text : colors.textMuted }]}>
          {s?.activityScore ?? EMPTY_VALUE}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>score</Text>
      </View>
    </View>
  );
}

function dayHasData(summary: DailySummary): boolean {
  return hasAnyMetric(summary) || summary.workoutCount > 0;
}

const styles = StyleSheet.create({
  listCard: { paddingVertical: 0 },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  dayMain: { flex: 1, gap: 2 },
  scoreBadge: { alignItems: 'flex-end', minWidth: 48 },
});
