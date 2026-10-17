import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { calculateActivityScore, SCORE_TARGETS, SCORE_WEIGHTS } from '@/domain/activityScore';
import { isCalendarEmpty, type CalendarDay, type CalendarSummary } from '@/domain/calendar';
import { fromDateKey } from '@/domain/dates';
import type { EnergyUnit } from '@/domain/models';
import { EMPTY_VALUE, formatDayLabel, formatEnergy, formatMetric, formatNumber } from '@/lib/format';
import type { CalendarSnapshot } from '@/services/ActivityService';
import { ActivityCalendarGrid, ActivityCalendarLegend, longDateLabel } from '../components/ActivityCalendar';
import { Card, Screen, SectionTitle } from '../components/primitives';
import { SnapshotNotices } from '../components/SnapshotNotices';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '../components/StateViews';
import { useActivityCalendar } from '../hooks';
import { spacing, typography, useTheme } from '../theme';
import { WorkoutRow } from './WorkoutsScreen';

export function CalendarScreen({ now = () => new Date() }: { now?: () => Date }) {
  const { snapshot, calendar } = useActivityCalendar();

  if (snapshot.isPending || (snapshot.isSuccess && calendar.isPending)) {
    return (
      <Screen>
        <LoadingState label="Loading your 30-day history…" />
      </Screen>
    );
  }

  return (
    <Screen testID="calendar" refreshing={snapshot.isRefetching} onRefresh={() => snapshot.refetch()}>
      {snapshot.isError || calendar.isError || !calendar.data ? (
        <ErrorState onRetry={() => (snapshot.isError ? snapshot.refetch() : calendar.refetch())} />
      ) : (
        <>
          <SnapshotNotices snapshot={snapshot.data} />
          <CalendarContent calendar={calendar.data} now={now()} />
        </>
      )}
    </Screen>
  );
}

export function CalendarContent({ calendar, now }: { calendar: CalendarSnapshot; now: Date }) {
  const { days, summary, settings } = calendar;
  const today = days[days.length - 1]?.date ?? '';
  const [selected, setSelected] = useState(today);
  const { colors } = useTheme();

  if (!settings.healthDataEnabled) return <PermissionDeniedState />;

  // Fall back to today if the selection scrolled out of the window (e.g. after midnight).
  const selectedDay = days.find((d) => d.date === selected) ?? days[days.length - 1];
  const empty = isCalendarEmpty(days);
  const first = days[0];
  const last = days[days.length - 1];

  return (
    <>
      {empty ? (
        <EmptyState
          title="No activity history yet"
          message="Days appear here once EdgeFit has saved activity from Health. Days without data are shown as no score, never as zero."
        />
      ) : (
        <CalendarStats summary={summary} now={now} />
      )}

      <SectionTitle>Last 30 days</SectionTitle>
      <Card style={styles.calendarCard}>
        {first && last ? (
          <Text style={[typography.caption, styles.range, { color: colors.textMuted }]}>
            {rangeLabel(first.date, last.date)}
          </Text>
        ) : null}
        <ActivityCalendarGrid days={days} selectedDate={selectedDay?.date ?? today} onSelect={setSelected} />
        <ActivityCalendarLegend />
      </Card>

      {selectedDay ? (
        <>
          <SectionTitle>Selected day</SectionTitle>
          <DayDetails day={selectedDay} now={now} unit={settings.energyUnit} />
        </>
      ) : null}
    </>
  );
}

function CalendarStats({ summary, now }: { summary: CalendarSummary; now: Date }) {
  const { colors } = useTheme();
  const missing = summary.totalDays - summary.scoredDays;
  return (
    <Card testID="calendar-stats">
      <View style={styles.stats}>
        <Stat
          testID="stat-coverage"
          label="Days with a score"
          value={`${summary.scoredDays} of ${summary.totalDays}`}
        />
        <Stat
          testID="stat-average"
          label="Average score"
          value={summary.averageScore === null ? EMPTY_VALUE : formatNumber(summary.averageScore)}
        />
        <Stat
          testID="stat-best"
          label={summary.best ? `Best day · ${formatDayLabel(summary.best.date, now)}` : 'Best day'}
          value={summary.best ? String(summary.best.score) : EMPTY_VALUE}
        />
      </View>
      <Text style={[typography.caption, styles.statsNote, { color: colors.textMuted }]}>
        {missing > 0
          ? `Average and best day use only the ${summary.scoredDays} day${summary.scoredDays === 1 ? '' : 's'} with a score. The other ${missing} have no data saved on this device, or not enough to calculate a score, and are left out rather than counted as zero.`
          : 'Every day in this period has a score.'}{' '}
        Today is still in progress.
      </Text>
    </Card>
  );
}

function Stat({ label, value, testID }: { label: string; value: string; testID: string }) {
  const { colors } = useTheme();
  const missing = value === EMPTY_VALUE;
  return (
    <View testID={testID} style={styles.stat} accessible accessibilityLabel={`${label}: ${missing ? 'not available' : value}`}>
      <Text style={[typography.metric, { color: missing ? colors.textMuted : colors.text }]} maxFontSizeMultiplier={1.3}>
        {value}
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function DayDetails({ day, now, unit }: { day: CalendarDay; now: Date; unit: EnergyUnit }) {
  const { colors } = useTheme();
  const s = day.summary;
  // Same formula and inputs as the stored score, so the breakdown always adds up to it.
  const breakdown =
    s && day.score !== null
      ? calculateActivityScore({ steps: s.steps, activeMinutes: s.activeMinutes, workoutMinutes: s.workoutMinutes })
      : null;

  return (
    <Card testID={`calendar-details-${day.date}`}>
      <Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]}>
        {longDateLabel(day.date)}
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        {day.isToday ? 'Today · still in progress, totals may grow' : formatDayLabel(day.date, now)}
      </Text>

      <View style={styles.scoreRow} accessible accessibilityLabel={day.score === null ? 'Activity Score: not available' : `Activity Score: ${day.score} out of 100`}>
        <Text style={[typography.largeNumber, { color: day.score === null ? colors.textMuted : colors.text }]}>
          {day.score ?? EMPTY_VALUE}
        </Text>
        <Text style={[typography.caption, styles.scoreCaption, { color: colors.textMuted }]}>
          {day.score === null
            ? 'No Activity Score: there is no data for this day, or not enough to calculate one.'
            : 'Activity Score out of 100'}
        </Text>
      </View>

      <DetailRow first label="Steps" value={formatMetric(s?.steps ?? null)} />
      <DetailRow label="Active energy" value={formatEnergy(s?.activeCalories ?? null, unit)} />
      <DetailRow
        label="Exercise minutes"
        value={s?.activeMinutes === null || s?.activeMinutes === undefined ? EMPTY_VALUE : `${s.activeMinutes} min`}
      />

      {breakdown ? (
        <View testID="calendar-score-breakdown" style={styles.breakdown}>
          <Text style={[typography.overline, { color: colors.textMuted }]}>Score breakdown</Text>
          <DetailRow first label={`Steps (target ${formatNumber(SCORE_TARGETS.steps)})`} value={`${breakdown.breakdown.steps} / ${SCORE_WEIGHTS.steps}`} />
          <DetailRow label={`Active minutes (target ${SCORE_TARGETS.activeMinutes})`} value={`${breakdown.breakdown.activeMinutes} / ${SCORE_WEIGHTS.activeMinutes}`} />
          <DetailRow label={`Workout minutes (target ${SCORE_TARGETS.workoutMinutes})`} value={`${breakdown.breakdown.workout} / ${SCORE_WEIGHTS.workout}`} />
        </View>
      ) : null}

      <Text style={[typography.overline, styles.workoutsTitle, { color: colors.textMuted }]}>Workouts</Text>
      {day.workouts.length === 0 ? (
        <Text testID="calendar-no-workouts" style={[typography.body, { color: colors.textMuted }]}>
          No workouts recorded on this day.
        </Text>
      ) : (
        day.workouts.map((w, i) => <WorkoutRow key={w.id} workout={w} now={now} unit={unit} first={i === 0} />)
      )}
    </Card>
  );
}

function DetailRow({ label, value, first }: { label: string; value: string; first?: boolean }) {
  const { colors } = useTheme();
  const missing = value === EMPTY_VALUE;
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${missing ? 'no data' : value}`}
      style={[styles.detailRow, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
    >
      <Text style={[typography.body, styles.detailLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[typography.body, { color: missing ? colors.textMuted : colors.text, fontVariant: ['tabular-nums'] }]}>
        {value}
      </Text>
    </View>
  );
}

function rangeLabel(first: string, last: string): string {
  const a = fromDateKey(first);
  const b = fromDateKey(last);
  const sameYear = a.getFullYear() === b.getFullYear();
  const start = a.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
  const end = b.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${start} – ${end}`;
}

const styles = StyleSheet.create({
  calendarCard: { padding: spacing.md },
  range: { marginBottom: spacing.sm, marginLeft: spacing.xs },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  stat: { flexBasis: '28%', flexGrow: 1, gap: 2 },
  statsNote: { marginTop: spacing.md },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm },
  scoreCaption: { flex: 1 },
  breakdown: { marginTop: spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
  detailLabel: { flex: 1 },
  workoutsTitle: { marginTop: spacing.lg },
});
