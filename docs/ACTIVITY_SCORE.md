# Activity Score

The Activity Score is a transparent, deterministic 0–100 summary of one day's movement.
It is an engagement summary, **not** a medical, clinical or fitness measurement.

Implementation: [`src/domain/activityScore.ts`](../src/domain/activityScore.ts) ·
Tests: [`src/domain/__tests__/activityScore.test.ts`](../src/domain/__tests__/activityScore.test.ts)

## Formula

```text
Activity Score = 40% Steps + 30% Active Minutes + 30% Workout Activity

steps component          = min(steps / stepTarget, 1)     × 40
active minutes component = min(activeMinutes / 30, 1)     × 30
workout component        = min(workoutMinutes / 30, 1)    × 30

total = round(steps + active minutes + workout)

stepTarget = your daily step goal, or 8,000 when no goal is set
```

| Component        | Weight | Full credit at | Source (iOS)                                  |
| ---------------- | ------ | -------------- | --------------------------------------------- |
| Steps            | 40     | step goal, or 8,000 | `HKQuantityTypeIdentifierStepCount` (daily sum) |
| Active minutes   | 30     | 30 minutes     | `HKQuantityTypeIdentifierAppleExerciseTime`   |
| Workout activity | 30     | 30 minutes     | Sum of `HKWorkout` durations started that day |

The minute targets are fixed round numbers chosen for readability. Thirty minutes of daily
activity reflects common public activity guidance. The steps target is your daily step goal
when you have set one (see [ADAPTIVE_GOALS.md](ADAPTIVE_GOALS.md)), and otherwise 8,000, a
moderate everyday target.

## Step goal and stored scores

Each day's row stores the steps target it was scored with (`daily_summaries.step_target`),
and the breakdown shows that target, so it always adds up to the stored score.

- Every sync re-scores the days it rewrites (today and the previous 14) with the goal in
  effect at that moment.
- Setting or accepting a goal re-scores those same days straight away, from the saved
  totals, so the Dashboard changes without waiting for a sync.
- Older days keep the target they were scored with.

## Missing data

- A metric with no data contributes **0** to the score.
- If steps **and** active minutes are both missing **and** there were no workouts, the
  day has no data and the score is `null` (shown as "—"), never 0.
- A measured zero (e.g. HealthKit reports 0 steps) is a real 0 and scores 0.
- Active energy is shown on the dashboard but deliberately not part of the score: it
  depends heavily on body size and device calibration.

## Worked example

6,420 steps, 34 active minutes, one 42-minute run:

```text
steps    = 6,420 / 8,000 × 40 = 32.1
minutes  = min(34 / 30, 1) × 30 = 30
workout  = min(42 / 30, 1) × 30 = 30
total    = round(92.1) = 92
```

The Dashboard's "How is this calculated?" disclosure shows this breakdown for the
current day.
