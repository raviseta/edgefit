import { addDaysToKey, fromDateKey, toDateKey } from '@/domain/dates';
import type { DateKey, StoredDailySummary } from '@/domain/models';
import { stepDayObservation } from './personalInsights';

/** Separate from the insight baseline: this requires a full recorded calendar week. */
export const STEP_FORECAST_WINDOW_DAYS = 7;
export const STEP_FORECAST_FEATURE_VERSION = 'steps-v1';
export const STEP_BASELINE_MODEL_VERSION = 'mean-7d-v1';

/** Unscaled model inputs. All step observations precede the local issue day. */
export interface StepForecastFeatures {
  yesterdaySteps: number;
  meanSteps7d: number;
  /** Population standard deviation, in steps (divisor = 7). */
  stdDevSteps7d: number;
  /** The target date falls on the user's locale weekend; a calendar feature known at issue time. */
  isTargetWeekend: 0 | 1;
}

/** ISO weekday numbers (1 = Monday … 7 = Sunday), the convention `Intl.Locale` week info uses. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
const DEFAULT_WEEKEND: readonly IsoWeekday[] = [6, 7];

/** Engines expose week info as `getWeekInfo()` (current) or the older `weekInfo` getter, or not at all. */
type LocaleWithWeekInfo = Intl.Locale & {
  getWeekInfo?: () => { weekend?: readonly number[] };
  weekInfo?: { weekend?: readonly number[] };
};

const isIsoWeekday = (day: number): day is IsoWeekday => Number.isInteger(day) && day >= 1 && day <= 7;

/**
 * The device locale's weekend days. Falls back to Saturday/Sunday where the
 * JS engine lacks `Intl.Locale` week info (e.g. older Hermes builds).
 */
export function localeWeekendDays(): readonly IsoWeekday[] {
  try {
    const locale = new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale) as LocaleWithWeekInfo;
    const weekend = (locale.getWeekInfo?.().weekend ?? locale.weekInfo?.weekend ?? []).filter(isIsoWeekday);
    return weekend.length ? weekend : DEFAULT_WEEKEND;
  } catch {
    return DEFAULT_WEEKEND;
  }
}

interface ForecastPeriod {
  issuedOn: DateKey;
  targetDate: DateKey;
  inputStart: DateKey;
  inputEnd: DateKey;
}

export type BaselineStepForecast = ForecastPeriod & { observedDays: number } & (
  | {
      status: 'ready';
      method: 'baseline';
      modelVersion: typeof STEP_BASELINE_MODEL_VERSION;
      /** Unrounded mean; display rounding belongs in the eventual UI. */
      predictedSteps: number;
      features: StepForecastFeatures;
    }
  | { status: 'insufficient-data' | 'unavailable' }
);

/** Retrospective learning example, never a claim that a forecast was saved at issue time. */
export interface StepForecastExample extends ForecastPeriod {
  features: StepForecastFeatures;
  actualSteps: number;
  baselineSteps: number;
}

interface ForecastInput {
  /** Bounded, retained summaries; one row per local date, as returned by the repository. */
  summaries: readonly StoredDailySummary[];
  /** False when the current refresh could not read steps, regardless of cached completeness. */
  stepsAvailable?: boolean;
  /** Weekend days for `isTargetWeekend`; defaults to the device locale's. */
  weekendDays?: readonly IsoWeekday[];
}

/** Candidate for tomorrow. Excludes today's still-changing activity, even if flagged complete. */
export function predictTomorrowSteps(input: ForecastInput & { now: Date }): BaselineStepForecast {
  const rows = new Map(input.summaries.map((row) => [row.date, row]));
  return forecastForIssueDate(rows, toDateKey(input.now), input.stepsAvailable ?? true, input.weekendDays ?? localeWeekendDays());
}

/**
 * Oldest-first examples with completed labels strictly before `asOf`'s local day.
 * A target T uses the same inputs as a live forecast issued on T−1: T−8…T−2.
 * T−1 is excluded because it would still have been in progress at issue time.
 * Completeness is what is known NOW; historical read timestamps/revisions are
 * unavailable, so this is a retrospective dataset, not a prospective backtest.
 */
export function buildStepForecastDataset(input: ForecastInput & { asOf: Date }): StepForecastExample[] {
  if (input.stepsAvailable === false) return [];
  const cutoff = toDateKey(input.asOf);
  const rows = new Map(input.summaries.map((row) => [row.date, row]));
  const weekendDays = input.weekendDays ?? localeWeekendDays();
  const dataset: StepForecastExample[] = [];

  for (const targetDate of [...rows.keys()].filter((date) => date < cutoff).sort()) {
    const actual = stepDayObservation(rows.get(targetDate));
    if (actual.status !== 'recorded') continue;
    const forecast = forecastForIssueDate(rows, addDaysToKey(targetDate, -1), true, weekendDays);
    if (forecast.status !== 'ready') continue;
    dataset.push({
      issuedOn: forecast.issuedOn,
      targetDate,
      inputStart: forecast.inputStart,
      inputEnd: forecast.inputEnd,
      features: forecast.features,
      actualSteps: actual.value,
      baselineSteps: forecast.predictedSteps,
    });
  }
  return dataset;
}

function forecastForIssueDate(
  rows: ReadonlyMap<DateKey, StoredDailySummary>,
  issuedOn: DateKey,
  available: boolean,
  weekendDays: readonly IsoWeekday[],
): BaselineStepForecast {
  const period: ForecastPeriod = {
    issuedOn,
    targetDate: addDaysToKey(issuedOn, 1),
    inputStart: addDaysToKey(issuedOn, -STEP_FORECAST_WINDOW_DAYS),
    inputEnd: addDaysToKey(issuedOn, -1),
  };
  if (!available) return { ...period, status: 'unavailable', observedDays: 0 };

  const steps: number[] = [];
  for (let offset = -STEP_FORECAST_WINDOW_DAYS; offset < 0; offset++) {
    const observation = stepDayObservation(rows.get(addDaysToKey(issuedOn, offset)));
    if (observation.status === 'recorded') steps.push(observation.value);
  }
  if (steps.length < STEP_FORECAST_WINDOW_DAYS) {
    return { ...period, status: 'insufficient-data', observedDays: steps.length };
  }

  const mean = steps.reduce((sum, value) => sum + value, 0) / steps.length;
  const variance = steps.reduce((sum, value) => sum + (value - mean) ** 2, 0) / steps.length;
  const jsDay = fromDateKey(period.targetDate).getDay(); // 0 = Sunday
  const weekday = (jsDay === 0 ? 7 : jsDay) as IsoWeekday;
  return {
    ...period,
    status: 'ready',
    method: 'baseline',
    modelVersion: STEP_BASELINE_MODEL_VERSION,
    observedDays: steps.length,
    predictedSteps: mean,
    features: {
      yesterdaySteps: steps[steps.length - 1]!,
      meanSteps7d: mean,
      stdDevSteps7d: Math.sqrt(variance),
      isTargetWeekend: weekendDays.includes(weekday) ? 1 : 0,
    },
  };
}
