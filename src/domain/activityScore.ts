/**
 * Activity Score — a transparent, deterministic 0–100 summary of a day.
 *
 *   Activity Score = 40% Steps + 30% Active Minutes + 30% Workout Activity
 *
 *   steps component         = min(steps / 8,000, 1)        × 40
 *   active minutes component = min(activeMinutes / 30, 1)  × 30
 *   workout component       = min(workoutMinutes / 30, 1)  × 30
 *
 * A missing metric contributes 0. If steps and active minutes are both missing
 * and there were no workouts, the day has no data and the score is `null`.
 *
 * This is an engagement summary, not a medical or fitness measurement.
 * See docs/ACTIVITY_SCORE.md.
 */

export const SCORE_WEIGHTS = { steps: 40, activeMinutes: 30, workout: 30 } as const;
export const SCORE_TARGETS = { steps: 8000, activeMinutes: 30, workoutMinutes: 30 } as const;

export interface ActivityScoreInput {
  steps: number | null;
  activeMinutes: number | null;
  workoutMinutes: number;
}

export interface ActivityScoreBreakdown {
  steps: number;
  activeMinutes: number;
  workout: number;
}

export interface ActivityScore {
  total: number;
  breakdown: ActivityScoreBreakdown;
}

function component(value: number | null, target: number, weight: number): number {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(value / target, 1) * weight;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function calculateActivityScore(input: ActivityScoreInput): ActivityScore | null {
  const workoutMinutes = Math.max(0, input.workoutMinutes || 0);
  if (input.steps === null && input.activeMinutes === null && workoutMinutes === 0) {
    return null;
  }

  const steps = component(input.steps, SCORE_TARGETS.steps, SCORE_WEIGHTS.steps);
  const activeMinutes = component(input.activeMinutes, SCORE_TARGETS.activeMinutes, SCORE_WEIGHTS.activeMinutes);
  const workout = component(workoutMinutes, SCORE_TARGETS.workoutMinutes, SCORE_WEIGHTS.workout);

  return {
    total: Math.round(steps + activeMinutes + workout),
    breakdown: { steps: round1(steps), activeMinutes: round1(activeMinutes), workout: round1(workout) },
  };
}
