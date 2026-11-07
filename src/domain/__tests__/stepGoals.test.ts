import { addDaysToKey, toDateKey } from '../dates';
import type { StoredDailySummary } from '../models';
import { EMPTY_GOAL_PREFERENCES, suggestStepGoal, type GoalPreferences } from '../stepGoals';

const now = new Date(2026, 10, 2, 0, 1); // Includes the autumn DST boundary.
function rows(values: (number | null)[]): StoredDailySummary[] {
  return values.map((steps, i) => ({ date: addDaysToKey(toDateKey(now), i - 14), steps,
    activeCalories: null, activeMinutes: null, workoutCount: 0, workoutMinutes: 0, stepTarget: 8000, activityScore: null,
    complete: { steps: true, activeCalories: false, activeMinutes: false, workouts: false } }));
}
function calculate(values: (number | null)[], preferences: GoalPreferences = EMPTY_GOAL_PREFERENCES) {
  return suggestStepGoal({ now, summaries: rows(values), preferences, available: true });
}
const goal = (activeSteps: number): GoalPreferences => ({ goal: { activeSteps, source: 'accepted_suggestion', updatedAt: now.toISOString() }, dismissedUntil: null });

it.each([9, 10, 14])('requires 10 days: %i valid', (count) => {
  expect(calculate(Array(count).fill(8000))).toMatchObject({ validDays: count, status: count < 10 ? 'insufficient_data' : 'suggested' });
});
it('distinguishes null from zero and excludes partial days and today', () => {
  const summaries = rows([null, 0, ...Array(12).fill(8000)]);
  summaries[2]!.complete.steps = false;
  summaries.push({ ...summaries[3]!, date: toDateKey(now), steps: 999999 });
  expect(suggestStepGoal({ now, summaries, preferences: EMPTY_GOAL_PREFERENCES, available: true })).toMatchObject({ validDays: 12, baselineSteps: 8000, periodStartLocal: '2026-10-19', periodEndLocal: '2026-11-01' });
});
it('calculates odd and even medians without outlier distortion', () => {
  expect(calculate([...Array(10).fill(8000), 99999]).baselineSteps).toBe(8000);
  expect(calculate([...Array(5).fill(7000), ...Array(5).fill(9000)]).baselineSteps).toBe(8000);
});
it('applies 5% and rounds to 250', () => {
  expect(calculate(Array(14).fill(8000))).toMatchObject({ status: 'suggested', suggestedSteps: 8500 });
});
it('floors the upward cap so rounding cannot exceed 10%', () => {
  expect(calculate(Array(14).fill(10000), goal(8100))).toMatchObject({ suggestedSteps: 8750 });
});
it('does not lower goals or invent a target from zero', () => {
  expect(calculate(Array(14).fill(0))).toMatchObject({ reason: 'zero_baseline' });
  expect(calculate(Array(14).fill(7000), goal(8000))).toMatchObject({ reason: 'current_above_baseline' });
  expect(calculate(Array(14).fill(100), goal(100))).toMatchObject({ status: 'no_suggestion' });
  expect(calculate(Array(14).fill(2000), goal(2000))).toMatchObject({ reason: 'small_change' });
});
it('suppresses manual, dismissed and unavailable suggestions', () => {
  expect(calculate(Array(14).fill(8000), { ...goal(8000), goal: { ...goal(8000).goal!, source: 'manual' } })).toMatchObject({ reason: 'manual' });
  expect(calculate(Array(14).fill(8000), { goal: null, dismissedUntil: '2026-11-03' })).toMatchObject({ reason: 'dismissed' });
  expect(suggestStepGoal({ now, summaries: rows(Array(14).fill(8000)), preferences: EMPTY_GOAL_PREFERENCES, available: false })).toMatchObject({ reason: 'unavailable' });
});
it('invalidates identity for changed data, day, preference or timezone offset', () => {
  const base = { now, summaries: rows(Array(14).fill(8000)), preferences: EMPTY_GOAL_PREFERENCES, available: true };
  const token = suggestStepGoal(base).token;
  expect(calculate(Array(14).fill(8001)).token).not.toBe(token);
  expect(suggestStepGoal({ ...base, now: new Date(2026, 10, 3) }).token).not.toBe(token);
  const offset = jest.spyOn(now, 'getTimezoneOffset').mockReturnValue(999);
  expect(suggestStepGoal(base).token).not.toBe(token);
  offset.mockRestore();
});
