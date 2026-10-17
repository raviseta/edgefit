import { workoutDateKey } from '@/health/normalization';
import { lastNDayKeys, toDateKey } from './dates';
import type { DailySummary, DateKey, Workout } from './models';

/**
 * 30-day activity calendar: one entry per local calendar day, built from the
 * persisted daily summaries and workouts. Nothing here recomputes the Activity
 * Score; the stored score is the single source of truth, and a day without a
 * valid score is "unknown", never zero.
 */

export const CALENDAR_DAYS = 30;

/**
 * Heatmap intensity. `unknown` = no valid score (no data, or not enough to score);
 * `zero` = a valid score of 0; 1–4 = score bands of 25 points.
 */
export type ScoreLevel = 'unknown' | 'zero' | 1 | 2 | 3 | 4;

export const SCORE_LEVEL_BANDS: { level: Exclude<ScoreLevel, 'unknown' | 'zero'>; label: string }[] = [
  { level: 1, label: '1–24' },
  { level: 2, label: '25–49' },
  { level: 3, label: '50–74' },
  { level: 4, label: '75–100' },
];

export interface CalendarDay {
  date: DateKey;
  /** Stored summary for the day, or null when EdgeFit has nothing saved for it. */
  summary: DailySummary | null;
  /** Workouts that started on this local day, newest first. */
  workouts: Workout[];
  /** Valid Activity Score, or null when unknown. */
  score: number | null;
  level: ScoreLevel;
  isToday: boolean;
}

export interface CalendarSummary {
  totalDays: number;
  /** Days with a valid Activity Score (the coverage numerator). */
  scoredDays: number;
  /** Mean of valid scores only; null when no day has a score. */
  averageScore: number | null;
  /** Highest valid score; ties go to the most recent day. Null when no day has a score. */
  best: { date: DateKey; score: number } | null;
}

export function scoreLevel(score: number | null): ScoreLevel {
  if (score === null || !Number.isFinite(score)) return 'unknown';
  if (score <= 0) return 'zero';
  if (score < 25) return 1;
  if (score < 50) return 2;
  if (score < 75) return 3;
  return 4;
}

/** The latest `CALENDAR_DAYS` local dates including today, oldest first, joined with stored data. */
export function buildCalendarDays(now: Date, summaries: DailySummary[], workouts: Workout[]): CalendarDay[] {
  const today = toDateKey(now);
  const summaryByDate = new Map(summaries.map((s) => [s.date, s]));
  const workoutsByDate = new Map<DateKey, Workout[]>();
  for (const workout of workouts) {
    const key = workoutDateKey(workout);
    workoutsByDate.set(key, [...(workoutsByDate.get(key) ?? []), workout]);
  }

  return lastNDayKeys(CALENDAR_DAYS, now).map((date) => {
    const summary = summaryByDate.get(date) ?? null;
    const score = validScore(summary);
    return {
      date,
      summary,
      workouts: (workoutsByDate.get(date) ?? []).sort((a, b) => b.startDate.localeCompare(a.startDate)),
      score,
      level: scoreLevel(score),
      isToday: date === today,
    };
  });
}

export function summarizeCalendar(days: CalendarDay[]): CalendarSummary {
  let total = 0;
  let scoredDays = 0;
  let best: CalendarSummary['best'] = null;
  for (const day of days) {
    if (day.score === null) continue;
    scoredDays += 1;
    total += day.score;
    if (!best || day.score >= best.score) best = { date: day.date, score: day.score };
  }
  return {
    totalDays: days.length,
    scoredDays,
    averageScore: scoredDays > 0 ? total / scoredDays : null,
    best,
  };
}

/** True when nothing at all is stored for the period: no metrics, scores or workouts. */
export function isCalendarEmpty(days: CalendarDay[]): boolean {
  return days.every(
    (d) =>
      d.workouts.length === 0 &&
      (d.summary === null ||
        (d.summary.steps === null &&
          d.summary.activeCalories === null &&
          d.summary.activeMinutes === null &&
          d.summary.workoutCount === 0)),
  );
}

function validScore(summary: DailySummary | null): number | null {
  const score = summary?.activityScore;
  return score === null || score === undefined || !Number.isFinite(score) ? null : score;
}
