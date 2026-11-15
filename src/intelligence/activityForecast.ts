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
  /** Saturday/Sunday on the target date; a calendar feature known at issue time. */
  isTargetWeekend: 0 | 1;
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
}

/** Candidate for tomorrow. Excludes today's still-changing activity, even if flagged complete. */
export function predictTomorrowSteps(input: ForecastInput & { now: Date }): BaselineStepForecast {
  return forecastForIssueDate(new Map(input.summaries.map((row) => [row.date, row])), toDateKey(input.now), input.stepsAvailable ?? true);
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
  const dataset: StepForecastExample[] = [];

  for (const targetDate of [...rows.keys()].filter((date) => date < cutoff).sort()) {
    const actual = stepDayObservation(rows.get(targetDate));
    if (actual.status !== 'recorded') continue;
    const forecast = forecastForIssueDate(rows, addDaysToKey(targetDate, -1), true);
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
  const weekday = fromDateKey(period.targetDate).getDay();
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
      isTargetWeekend: weekday === 0 || weekday === 6 ? 1 : 0,
    },
  };
}
