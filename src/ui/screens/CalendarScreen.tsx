import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { calculateActivityScore, SCORE_TARGETS, SCORE_WEIGHTS } from '@/domain/activityScore';
import { isCalendarEmpty, type CalendarDay, type CalendarSummary } from '@/domain/calendar';
import { fromDateKey } from '@/domain/dates';
import { hasAnyMetric, type EnergyUnit } from '@/domain/models';
import { EMPTY_VALUE, formatDayLabel, formatEnergyValue, formatMetric, formatNumber } from '@/lib/format';
import type { CalendarSnapshot } from '@/services/ActivityService';
import { ActivityCalendarGrid, ActivityCalendarLegend, longDateLabel } from '../components/ActivityCalendar';
import { scoreHeadline, type MetricKind } from '../components/ActivityCards';
import { Card, Chip, Screen, SectionTitle } from '../components/primitives';
import { SnapshotNotices } from '../components/SnapshotNotices';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '../components/StateViews';
import { Icon, IconChip, ProgressRing, type IconName } from '../components/visuals';
import { useActivityCalendar } from '../hooks';
import { fonts, radius, spacing, typography, useTheme, type ThemeColors } from '../theme';
import { WorkoutRow } from './WorkoutsScreen';

/** Below this many scored days the calendar explains that history is still building. */
const SPARSE_DAYS = 21;

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
          message="Days appear here once EdgeFit has saved activity from Health. Days without data are shown as outlines, never as zero."
        />
      ) : (
        <CalendarHeader summary={summary} range={first && last ? rangeLabel(first.date, last.date) : ''} now={now} />
      )}

      <Card style={styles.calendarCard}>
        <ActivityCalendarGrid days={days} selectedDate={selectedDay?.date ?? today} onSelect={setSelected} />
        <ActivityCalendarLegend />
      </Card>

      {!empty && summary.scoredDays < SPARSE_DAYS ? (
        <View testID="calendar-sparse-note" accessibilityRole="text" style={[styles.note, { backgroundColor: colors.accentSoft }]}>
          <Icon name="info" size={16} color={colors.accent} />
          <Text style={[typography.caption, styles.noteText, { color: colors.text }]}>
            Building your history. Outlined days have no score: no Health data, or not enough to calculate one. They
            never count as zero.
          </Text>
        </View>
      ) : null}

      {selectedDay ? (
        <>
          <SectionTitle>Selected day</SectionTitle>
          <DayDetails day={selectedDay} now={now} unit={settings.energyUnit} />
        </>
      ) : null}
    </>
  );
}

function CalendarHeader({ summary, range, now }: { summary: CalendarSummary; range: string; now: Date }) {
  const { colors } = useTheme();
  const average = summary.averageScore === null ? null : Math.round(summary.averageScore);
  return (
    <View testID="calendar-stats" style={styles.header}>
      <Text style={[typography.overline, { color: colors.textMuted }]}>{range}</Text>
      <View
        style={styles.averageRow}
        accessible
        accessibilityLabel={`Average Activity Score: ${average === null ? 'not available' : average}, from scored days only`}
      >
        <Text style={[typography.score, { color: average === null ? colors.textMuted : colors.text }]}>
          {average ?? EMPTY_VALUE}
        </Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>average Activity Score</Text>
      </View>
      <View style={styles.chips}>
        <View accessible accessibilityLabel={`Days with a score: ${summary.scoredDays} of ${summary.totalDays}`}>
          <Chip label={`${summary.scoredDays} of ${summary.totalDays} days scored`} color={colors.accent} />
        </View>
        {summary.streak > 0 ? (
          <View accessible accessibilityLabel={`Current streak: ${summary.streak} day${summary.streak === 1 ? '' : 's'}`}>
            <Chip label={`${summary.streak}-day streak`} color={colors.metricWorkouts} />
          </View>
        ) : null}
        {summary.best ? (
          <View accessible accessibilityLabel={`Best day: ${formatDayLabel(summary.best.date, now)}, score ${summary.best.score}`}>
            <Chip label={`Best ${summary.best.score} · ${formatDayLabel(summary.best.date, now)}`} color={colors.metricTime} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const TILE_STYLE: Record<MetricKind, { icon: IconName; color: keyof ThemeColors; soft: keyof ThemeColors }> = {
  steps: { icon: 'steps', color: 'metricSteps', soft: 'metricStepsSoft' },
  energy: { icon: 'energy', color: 'metricEnergy', soft: 'metricEnergySoft' },
  time: { icon: 'clock', color: 'metricTime', soft: 'metricTimeSoft' },
  workouts: { icon: 'dumbbell', color: 'metricWorkouts', soft: 'metricWorkoutsSoft' },
};

function DayDetails({ day, now, unit }: { day: CalendarDay; now: Date; unit: EnergyUnit }) {
  const { colors } = useTheme();
  const s = day.summary;
  const hasData = (s !== null && (hasAnyMetric(s) || s.workoutCount > 0)) || day.workouts.length > 0;
  // Same formula and inputs as the stored score, so the breakdown always adds up to it.
  const breakdown =
    s && day.score !== null
      ? calculateActivityScore({ steps: s.steps, activeMinutes: s.activeMinutes, workoutMinutes: s.workoutMinutes })
      : null;
  const workoutMinutes = day.workouts.reduce((sum, w) => sum + w.durationMinutes, 0);

  const subtitle = day.isToday
    ? 'Today · totals may still grow'
    : day.score !== null
      ? 'Final totals'
      : hasData
        ? 'Partial data · not enough for a score'
        : 'No Health data recorded';

  return (
    <Card testID={`calendar-details-${day.date}`} style={styles.details}>
      <View style={styles.detailsHeader}>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
            {longDateLabel(day.date)}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{subtitle}</Text>
        </View>
        {day.isToday ? <Chip testID="calendar-in-progress" label="In progress" color={colors.warning} /> : null}
      </View>

      {day.score !== null ? (
        <View
          style={styles.scoreRow}
          accessible
          accessibilityLabel={`Activity Score: ${day.score} out of 100, ${scoreHeadline(day.score)}`}
        >
          <ProgressRing progress={day.score / 100} size={88} strokeWidth={8} color={colors.accent} trackColor={colors.surfaceMuted}>
            <Text style={[styles.ringScore, { color: colors.text }]} maxFontSizeMultiplier={1.2}>
              {day.score}
            </Text>
          </ProgressRing>
          <View style={styles.flex}>
            <Text style={[typography.headline, { color: colors.text }]}>{scoreHeadline(day.score)}</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Activity Score out of 100</Text>
          </View>
        </View>
      ) : null}

      {hasData ? (
        <>
          {day.score === null ? (
            <Text accessible accessibilityLabel="Activity Score: not available" style={[typography.body, { color: colors.textMuted }]}>
              Not enough data to calculate an Activity Score for this day. Missing values are shown as {EMPTY_VALUE}, not zero.
            </Text>
          ) : null}
          <View style={styles.tiles}>
            <MetricTile kind="steps" label="Steps" value={formatMetric(s?.steps ?? null)} />
            <MetricTile kind="energy" label="Active energy" value={formatEnergyValue(s?.activeCalories ?? null, unit)} unit={unit} />
            <MetricTile
              kind="time"
              label="Exercise"
              value={s?.activeMinutes === null || s?.activeMinutes === undefined ? EMPTY_VALUE : String(s.activeMinutes)}
              unit="min"
            />
            <MetricTile
              kind="workouts"
              label={day.workouts.length === 1 ? 'Workout' : 'Workouts'}
              value={String(day.workouts.length)}
              unit={day.workouts.length > 0 ? `· ${workoutMinutes} min` : undefined}
            />
          </View>
        </>
      ) : (
        <View testID="calendar-no-data" style={styles.none}>
          <IconChip name="chart" size={52} color={colors.accent} background={colors.accentSoft} />
          <Text style={[typography.headline, { color: colors.text }]}>
            {day.isToday ? 'Nothing from Health yet today' : 'No data for this day'}
          </Text>
          <Text style={[typography.body, styles.center, { color: colors.textMuted }]}>
            {day.isToday
              ? 'Your summary appears once your phone or watch records activity. Missing days are never counted as zero.'
              : 'EdgeFit had nothing from Health for this date, so it has no score. Missing days are never counted as zero.'}
          </Text>
        </View>
      )}

      {breakdown ? (
        <View testID="calendar-score-breakdown" style={styles.breakdown}>
          <Text style={[typography.overline, { color: colors.textMuted }]}>Score breakdown</Text>
          <BreakdownBar label={`Steps (target ${formatNumber(SCORE_TARGETS.steps)})`} value={breakdown.breakdown.steps} max={SCORE_WEIGHTS.steps} />
          <BreakdownBar label={`Active minutes (target ${SCORE_TARGETS.activeMinutes})`} value={breakdown.breakdown.activeMinutes} max={SCORE_WEIGHTS.activeMinutes} />
          <BreakdownBar label={`Workout minutes (target ${SCORE_TARGETS.workoutMinutes})`} value={breakdown.breakdown.workout} max={SCORE_WEIGHTS.workout} />
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            A simple summary of the day&apos;s movement, not a medical or fitness measurement.
          </Text>
        </View>
      ) : null}

      {day.workouts.length > 0 ? (
        <View testID="calendar-workouts">
          <Text style={[typography.overline, { color: colors.textMuted }]}>Workouts</Text>
          {day.workouts.map((w, i) => (
            <WorkoutRow key={w.id} workout={w} now={now} unit={unit} first={i === 0} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function MetricTile({ kind, label, value, unit }: { kind: MetricKind; label: string; value: string; unit?: string }) {
  const { colors } = useTheme();
  const t = TILE_STYLE[kind];
  const missing = value === EMPTY_VALUE;
  // "1 · 42 min" is read as "1, 42 min"; "296 kcal" as is.
  const spokenUnit = !unit ? '' : unit.startsWith('· ') ? `, ${unit.slice(2)}` : ` ${unit}`;
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${missing ? 'no data' : `${value}${spokenUnit}`}`}
      style={[styles.tile, { backgroundColor: colors.surfaceMuted }]}
    >
      <IconChip name={t.icon} size={30} color={colors[t.color]} background={colors[t.soft]} />
      <View>
        <Text style={[styles.tileValue, { color: missing ? colors.textMuted : colors.text }]} maxFontSizeMultiplier={1.3}>
          {value}
          {unit && !missing ? <Text style={[typography.caption, { color: colors.textMuted }]}> {unit}</Text> : null}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      </View>
    </View>
  );
}

function BreakdownBar({ label, value, max }: { label: string; value: number; max: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.bar} accessible accessibilityLabel={`${label}: ${value} of ${max}`}>
      <View style={styles.barLabels}>
        <Text style={[typography.caption, styles.flex, { color: colors.text }]}>{label}</Text>
        <Text style={[typography.caption, styles.barValue, { color: colors.text }]}>
          {value} <Text style={{ color: colors.textMuted, fontFamily: fonts.body }}>/ {max}</Text>
        </Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: colors.surfaceMuted }]}>
        <View style={[styles.barFill, { width: `${Math.round((value / max) * 100)}%`, backgroundColor: colors.accent }]} />
      </View>
    </View>
  );
}

function rangeLabel(first: string, last: string): string {
  const fmt = (key: string) => fromDateKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(first)} – ${fmt(last)}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  header: { gap: spacing.xs, paddingHorizontal: spacing.xs, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  averageRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 6 },
  calendarCard: { paddingTop: spacing.xl, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  noteText: { flex: 1 },
  details: { gap: spacing.lg },
  detailsHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  ringScore: { fontFamily: fonts.displayHeavy, fontSize: 28, lineHeight: 32, fontVariant: ['tabular-nums'] },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1, borderRadius: radius.field, padding: spacing.md, gap: spacing.sm },
  tileValue: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  none: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  breakdown: { gap: spacing.md },
  bar: { gap: 6 },
  barLabels: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barValue: { fontFamily: fonts.bodySemibold, fontVariant: ['tabular-nums'] },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
});
