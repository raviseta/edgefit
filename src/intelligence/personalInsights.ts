import { addDaysToKey, toDateKey } from '@/domain/dates';
import { hasAnyMetric, type DateKey, type HealthMetric, type StoredDailySummary, type Workout } from '@/domain/models';
import { workoutDateKey } from '@/health/normalization';
import { formatDateRange, formatNumber } from '@/lib/format';

/**
 * Personal Activity Insights: deterministic observations over the last two
 * complete weeks of locally stored data. Today is always excluded because it
 * is still in progress.
 *
 * Each insight only uses a day's metric when that metric is marked complete:
 * read fresh after the day ended (see `SummaryRepository.upsertMany`). A
 * partial value is left out rather than treated as a full day, and a metric
 * that failed to sync doesn't hold back insights built on other metrics.
 * Missing metrics are never treated as zero.
 *
 * Every result carries its own display strings, so the UI does no math.
 */

export const INSIGHT_WINDOW_DAYS = 7;
/** Complete days read before today: the current week plus the week before it. */
export const PERSONAL_INSIGHT_LOOKBACK_DAYS = 2 * INSIGHT_WINDOW_DAYS;
/** Days with recorded steps required in *each* week before the weeks are compared. */
export const MIN_STEP_DAYS_PER_WEEK = 5;
/** Workouts shorter than this don't count toward exercise frequency. */
export const MIN_WORKOUT_MINUTES = 1;

export interface InsightPeriod {
  /** Inclusive local dates. */
  start: DateKey;
  end: DateKey;
  label: string;
}

/** Display content for one eligible insight. */
export interface PersonalInsightCard {
  title: string;
  observation: string;
  period: string;
  details: string[];
  explanation: string;
}

type Eligible<K extends string, T> = { kind: K; status: 'eligible'; card: PersonalInsightCard } & T;
type Ineligible<K extends string, R extends string> = { kind: K; status: 'ineligible'; reason: R; message: string };

export type ActivityConsistency =
  | Eligible<'activity-consistency', { period: InsightPeriod; activeDays: number; observedDays: number }>
  | Ineligible<'activity-consistency', 'no-complete-days'>;

export interface StepWeek {
  period: InsightPeriod;
  /** Complete days with a recorded step count (a recorded 0 counts). */
  validDays: number;
  /** Mean over valid days, unrounded; null when there are none. */
  averageSteps: number | null;
}

export type StepDirection = 'increased' | 'decreased' | 'unchanged';

export type WeeklyStepComparison =
  | Eligible<
      'weekly-steps',
      {
        current: StepWeek;
        previous: StepWeek;
        direction: StepDirection;
        /** (current − previous) / previous, unrounded; null when the previous average is 0. */
        percentChange: number | null;
      }
    >
  | (Ineligible<'weekly-steps', 'insufficient-data'> & { current: StepWeek; previous: StepWeek });

export type ExerciseFrequency =
  | Eligible<'exercise-frequency', { period: InsightPeriod; workoutDays: number; workoutCount: number }>
  | Ineligible<'exercise-frequency', 'incomplete-window'>;

export interface PersonalInsights {
  /** False when nothing at all is stored for the last two weeks. */
  hasAnyHistory: boolean;
  activityConsistency: ActivityConsistency;
  weeklySteps: WeeklyStepComparison;
  exerciseFrequency: ExerciseFrequency;
}

export interface PersonalInsightsInput {
  now: Date;
  /** Stored summaries; rows outside the two-week window are ignored. */
  summaries: StoredDailySummary[];
  /** Cached workouts; workouts outside the two-week window are ignored. */
  workouts: Workout[];
}

export function buildPersonalInsights(input: PersonalInsightsInput): PersonalInsights {
  const today = toDateKey(input.now);
  const current = period(addDaysToKey(today, -INSIGHT_WINDOW_DAYS), INSIGHT_WINDOW_DAYS);
  const previous = period(addDaysToKey(today, -PERSONAL_INSIGHT_LOOKBACK_DAYS), INSIGHT_WINDOW_DAYS);
  const lookback = new Set([...current.keys, ...previous.keys]);

  const rows = new Map(input.summaries.filter((s) => lookback.has(s.date)).map((s) => [s.date, s]));
  const workoutDays = new Map<DateKey, number>();
  for (const workout of input.workouts) {
    const key = workoutDateKey(workout);
    if (!lookback.has(key) || workout.durationMinutes < MIN_WORKOUT_MINUTES) continue;
    workoutDays.set(key, (workoutDays.get(key) ?? 0) + 1);
  }
  const completeRow: RowLookup = (key, metric) => {
    const row = rows.get(key);
    return row?.complete[metric] ? row : null;
  };

  const hasAnyHistory = [...rows.values()].some(hasAnyMetric) || workoutDays.size > 0;

  return {
    hasAnyHistory,
    activityConsistency: activityConsistency(current, completeRow, workoutDays),
    weeklySteps: weeklySteps(current, previous, completeRow),
    exerciseFrequency: exerciseFrequency(current, completeRow, workoutDays),
  };
}


/** The day's row when `metric` is complete on it, otherwise null. */
type RowLookup = (key: DateKey, metric: HealthMetric) => StoredDailySummary | null;
const QUANTITY_METRICS = ['steps', 'activeCalories', 'activeMinutes'] as const;
type PeriodKeys = InsightPeriod & { keys: DateKey[] };

function activityConsistency(current: PeriodKeys, completeRow: RowLookup, workoutDays: Map<DateKey, number>): ActivityConsistency {
  let observedDays = 0;
  let activeDays = 0;
  for (const key of current.keys) {
    // Only complete metrics count, so a day isn't observed from partial values.
    const values = QUANTITY_METRICS.flatMap((metric) => {
      const value = completeRow(key, metric)?.[metric];
      return value === null || value === undefined ? [] : [value];
    });
    const workouts = completeRow(key, 'workouts') ? (workoutDays.get(key) ?? 0) : 0;
    if (values.length === 0 && workouts === 0) continue;
    observedDays += 1;
    if (values.some((v) => v > 0) || workouts > 0) activeDays += 1;
  }

  if (observedDays === 0) {
    return {
      kind: 'activity-consistency',
      status: 'ineligible',
      reason: 'no-complete-days',
      message: 'Active days will appear once a full day of activity data has been saved.',
    };
  }

  return {
    kind: 'activity-consistency',
    status: 'eligible',
    period: strip(current),
    activeDays,
    observedDays,
    card: {
      title: 'Active days',
      observation: activeDaysObservation(activeDays, observedDays),
      period: current.label,
      details: [],
      explanation:
        'Counts days with any recorded steps, active energy, exercise minutes or a workout. Days without data on this device are not counted as inactive. Today is not included.',
    },
  };
}

function weeklySteps(
  current: PeriodKeys,
  previous: PeriodKeys,
  completeRow: RowLookup,
): WeeklyStepComparison {
  const cur = stepWeek(current, completeRow);
  const prev = stepWeek(previous, completeRow);

  if (cur.averageSteps === null || prev.averageSteps === null || cur.validDays < MIN_STEP_DAYS_PER_WEEK || prev.validDays < MIN_STEP_DAYS_PER_WEEK) {
    return {
      kind: 'weekly-steps',
      status: 'ineligible',
      reason: 'insufficient-data',
      message: `A weekly step comparison needs at least ${MIN_STEP_DAYS_PER_WEEK} days with recorded steps in each week (last 7 days: ${cur.validDays}, week before: ${prev.validDays}).`,
      current: cur,
      previous: prev,
    };
  }

  const percentChange = prev.averageSteps > 0 ? (cur.averageSteps - prev.averageSteps) / prev.averageSteps : null;
  // Direction follows the displayed (rounded) values, so the text never contradicts the numbers.
  const roundedPercent = percentChange === null ? null : Math.round(percentChange * 100);
  const roundedDiff = Math.round(cur.averageSteps) - Math.round(prev.averageSteps);
  const direction: StepDirection =
    roundedPercent !== null
      ? roundedPercent > 0
        ? 'increased'
        : roundedPercent < 0
          ? 'decreased'
          : 'unchanged'
      : roundedDiff > 0
        ? 'increased'
        : 'unchanged';

  const observation =
    direction === 'unchanged'
      ? 'Your recorded steps were about the same as the previous week.'
      : `Your recorded steps ${direction} compared with the previous week.`;

  return {
    kind: 'weekly-steps',
    status: 'eligible',
    current: cur,
    previous: prev,
    direction,
    percentChange,
    card: {
      title: 'Weekly steps',
      observation,
      period: `${current.label} vs ${previous.label}`,
      details: [
        `Last 7 days: ${formatNumber(cur.averageSteps)} steps a day on average (${cur.validDays} of ${INSIGHT_WINDOW_DAYS} days with steps).`,
        `Week before: ${formatNumber(prev.averageSteps)} steps a day on average (${prev.validDays} of ${INSIGHT_WINDOW_DAYS} days with steps).`,
        roundedPercent === null
          ? 'No percentage change is shown because the week before averaged 0 steps.'
          : `Change: ${formatPercent(roundedPercent)}.`,
      ],
      explanation: `Averages only the days with recorded steps in each week; days without step data are left out, not counted as zero. Needs at least ${MIN_STEP_DAYS_PER_WEEK} such days in each week. Today is not included.`,
    },
  };
}

function exerciseFrequency(
  current: PeriodKeys,
  completeRow: RowLookup,
  workoutDays: Map<DateKey, number>,
): ExerciseFrequency {
  // Workouts are cached by the same sync that writes the daily rows; until a sync has run
  // after the whole week ended, workouts late in the week may be missing.
  if (!current.keys.every((key) => completeRow(key, 'workouts') !== null)) {
    return {
      kind: 'exercise-frequency',
      status: 'ineligible',
      reason: 'incomplete-window',
      message: 'Workout days will appear once the last 7 days have been fully synced.',
    };
  }

  const days = current.keys.filter((key) => workoutDays.has(key));
  const workoutCount = days.reduce((sum, key) => sum + workoutDays.get(key)!, 0);

  return {
    kind: 'exercise-frequency',
    status: 'eligible',
    period: strip(current),
    workoutDays: days.length,
    workoutCount,
    card: {
      title: 'Workout days',
      observation:
        days.length === 0
          ? `No workouts were recorded in the last ${INSIGHT_WINDOW_DAYS} days.`
          : `You recorded workouts on ${plural(days.length, 'different day')} in the last ${INSIGHT_WINDOW_DAYS} days.`,
      period: current.label,
      details: days.length === 0 ? [] : [`${plural(workoutCount, 'workout')} in total.`],
      explanation: `Counts days with at least one workout of ${MIN_WORKOUT_MINUTES} minute or longer saved to Health. Several workouts on the same day count once. Exercise that wasn't saved as a workout isn't included. Today is not included.`,
    },
  };
}

function stepWeek(p: PeriodKeys, completeRow: RowLookup): StepWeek {
  const steps = p.keys.flatMap((key) => {
    const value = completeRow(key, 'steps')?.steps;
    return value === null || value === undefined ? [] : [value];
  });
  return {
    period: strip(p),
    validDays: steps.length,
    averageSteps: steps.length > 0 ? steps.reduce((a, b) => a + b, 0) / steps.length : null,
  };
}

function period(start: DateKey, days: number): PeriodKeys {
  const keys = Array.from({ length: days }, (_, i) => addDaysToKey(start, i));
  const end = keys[keys.length - 1]!;
  return { start, end, label: formatDateRange(start, end), keys };
}

function strip({ start, end, label }: PeriodKeys): InsightPeriod {
  return { start, end, label };
}

function formatPercent(rounded: number): string {
  if (rounded > 0) return `+${rounded}%`;
  if (rounded < 0) return `−${Math.abs(rounded)}%`;
  return '0%';
}

/** Days without data aren't inactive, so they never appear in the denominator. */
function activeDaysObservation(activeDays: number, observedDays: number): string {
  const window = `in the last ${INSIGHT_WINDOW_DAYS} days`;
  if (observedDays === INSIGHT_WINDOW_DAYS) return `You recorded activity on ${activeDays} of the last ${INSIGHT_WINDOW_DAYS} days.`;
  if (observedDays === 1) {
    return activeDays === 1
      ? `You recorded activity on the only day with data ${window}.`
      : `No activity was recorded on the only day with data ${window}.`;
  }
  if (activeDays === observedDays) return `You recorded activity on all ${observedDays} days with data ${window}.`;
  return `You recorded activity on ${activeDays} of ${observedDays} days with data ${window}.`;
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
