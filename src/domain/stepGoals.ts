import { addDaysToKey, toDateKey } from './dates';
import type { StoredDailySummary } from './models';

export const GOAL_ALGORITHM_VERSION = 'steps-median-v1';
/** Input bounds prevent accidental oversized entries; these are not recommended targets. */
export const MAX_STEP_GOAL = 100000;
export interface StepGoal {
  activeSteps: number;
  source: 'manual' | 'accepted_suggestion';
  updatedAt: string;
}
export interface GoalPreferences {
  goal: StepGoal | null;
  dismissedUntil: string | null;
}
export const EMPTY_GOAL_PREFERENCES: GoalPreferences = { goal: null, dismissedUntil: null };
export function isValidStepGoal(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= MAX_STEP_GOAL;
}
interface Calculation {
  validDays: number;
  windowDays: 14;
  periodStartLocal: string;
  periodEndLocal: string;
  baselineSteps: number | null;
  algorithmVersion: string;
  calculatedAt: string;
  /** Ephemeral input identity. Never persisted or logged. */
  token: string;
}
export type GoalSuggestion = Calculation & (
  | { status: 'suggested'; suggestedSteps: number }
  | { status: 'insufficient_data' | 'no_suggestion' | 'no_meaningful_change'; reason: 'coverage' | 'zero_baseline' | 'current_above_baseline' | 'small_change' | 'manual' | 'dismissed' | 'unavailable' }
);

export function suggestStepGoal(input: {
  now: Date;
  summaries: StoredDailySummary[];
  preferences: GoalPreferences;
  available: boolean;
}): GoalSuggestion {
  const today = toDateKey(input.now);
  const keys = Array.from({ length: 14 }, (_, i) => addDaysToKey(today, i - 14));
  const rows = new Map(input.summaries.map((s) => [s.date, s]));
  const values = keys.map((key) => {
    const row = rows.get(key);
    return row?.complete.steps && row.steps !== null && Number.isFinite(row.steps) && row.steps >= 0 ? row.steps : null;
  });
  const sorted = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const baseline = sorted.length === 0 ? null : sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  const common: Calculation = {
    validDays: sorted.length, windowDays: 14,
    periodStartLocal: keys[0]!, periodEndLocal: keys[13]!, baselineSteps: baseline,
    algorithmVersion: GOAL_ALGORITHM_VERSION, calculatedAt: input.now.toISOString(),
    token: JSON.stringify([GOAL_ALGORITHM_VERSION, keys, values, input.preferences, input.now.getTimezoneOffset(), Intl.DateTimeFormat().resolvedOptions().timeZone]),
  };
  const none = (status: 'insufficient_data' | 'no_suggestion' | 'no_meaningful_change', reason: Exclude<GoalSuggestion, { status: 'suggested' }>['reason']): GoalSuggestion => ({ ...common, status, reason });
  if (!input.available) return none('no_suggestion', 'unavailable');
  if (input.preferences.goal?.source === 'manual') return none('no_suggestion', 'manual');
  if (input.preferences.dismissedUntil && today < input.preferences.dismissedUntil) return none('no_suggestion', 'dismissed');
  if (sorted.length < 10) return none('insufficient_data', 'coverage');
  if (!baseline) return none('no_suggestion', 'zero_baseline');
  const current = input.preferences.goal?.activeSteps;
  if (current && baseline < current) return none('no_suggestion', 'current_above_baseline');
  let target = Math.round(baseline * 1.05 / 250) * 250;
  if (current) target = Math.min(target, Math.floor(current * 1.1 / 250) * 250);
  if (!isValidStepGoal(target)) return none('no_suggestion', 'zero_baseline');
  if (current && target - current < 250) return none('no_meaningful_change', 'small_change');
  return { ...common, status: 'suggested', suggestedSteps: target };
}
