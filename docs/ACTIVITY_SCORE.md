# Activity Score

The Activity Score is a transparent, deterministic 0–100 summary of one day's movement.
It is an engagement summary, **not** a medical, clinical or fitness measurement.

Implementation: [`src/domain/activityScore.ts`](../src/domain/activityScore.ts) ·
Tests: [`src/domain/__tests__/activityScore.test.ts`](../src/domain/__tests__/activityScore.test.ts)

## Formula

```text
Activity Score = 40% Steps + 30% Active Minutes + 30% Workout Activity

steps component          = min(steps / 8,000, 1)          × 40
active minutes component = min(activeMinutes / 30, 1)     × 30
workout component        = min(workoutMinutes / 30, 1)    × 30

total = round(steps + active minutes + workout)
```

| Component        | Weight | Full credit at | Source (iOS)                                  |
| ---------------- | ------ | -------------- | --------------------------------------------- |
| Steps            | 40     | 8,000 steps    | `HKQuantityTypeIdentifierStepCount` (daily sum) |
| Active minutes   | 30     | 30 minutes     | `HKQuantityTypeIdentifierAppleExerciseTime`   |
| Workout activity | 30     | 30 minutes     | Sum of `HKWorkout` durations started that day |

Targets are fixed round numbers chosen for readability, not personalized goals. Thirty
minutes of daily activity reflects common public activity guidance; 8,000 steps is a
moderate everyday target.

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
