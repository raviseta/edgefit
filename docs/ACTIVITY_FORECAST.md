# Tomorrow’s Activity Forecast — dataset and baseline

This is the first implementation milestone from the forecast plan: construct a
local learning dataset and a deterministic comparison baseline before training a
model or adding the Dashboard card. The implementation runs in TypeScript and
adds no dependencies.

## What is available

`ActivityService.refresh()` now returns `snapshot.activityForecast`:

| Field | Meaning |
| --- | --- |
| `dataSource` | `demo` for the mock provider; `healthkit` for Apple Health. Demo results are synthetic, not evidence of real-world accuracy. |
| `featureVersion` | `steps-v1`, identifying the feature definitions below. |
| `baseline` | Tomorrow’s candidate estimate, or an explicit insufficient-data/unavailable state. |
| `dataset` | Date-ordered retrospective examples with features, an actual step-count label, and the baseline prediction. |

The experiment is `null` when insights or health reading are switched off. If
steps cannot be read in the current refresh, the baseline is `unavailable` and
the dataset is empty, even if complete cached steps remain stored. Failure of an
unrelated metric does not block the step pipeline.

All results are recomputed in memory from retained summaries on refresh. They
are not saved forecasts, do not change goals, and are not displayed yet.

## Timing: forecast tomorrow using completed days

A forecast issued on local date **D** predicts **D+1**. Because D is still in
progress, inputs cover the seven calendar dates **D−7 through D−1**. The baseline
requires complete, recorded steps on all seven dates. Missing dates do not cause
the window to reach further back.

For example, a candidate generated on 30 September 2026 uses:

| Role | Local dates |
| --- | --- |
| Seven input dates | 23–29 September |
| Issue day, excluded from step features | 30 September |
| Target | 1 October |

The model features are:

| Feature | Definition |
| --- | --- |
| `yesterdaySteps` | Steps on D−1, the day before the **issue day**. |
| `meanSteps7d` | Arithmetic mean over the seven input dates, without rounding. |
| `stdDevSteps7d` | Population standard deviation of those seven values (divisor 7), in steps. |
| `isTargetWeekend` | 1 for a Saturday/Sunday target date; otherwise 0. This calendar information is known at issue time. |

The `mean-7d-v1` baseline predicts `meanSteps7d`. This is a fixed rule, not ML.
It has no confidence percentage or uncertainty interval. Future display code can
round the estimate; evaluation should use its unrounded value.

## Training rows and leakage

For a historical target **T**, its simulated issue day is **T−1** and its input
dates are **T−8 through T−2**. T−1 remains excluded, matching live inference.
For a 29 September target, the issue day is 28 September and the input dates are
21–27 September.

`buildStepForecastDataset()` includes an example only when:

1. The target is before the current local day and has complete recorded steps.
2. All seven input dates have complete recorded steps.

Recorded zeroes are valid inputs and labels. Missing/null, partial, negative and
non-finite values are excluded. Completeness is specific to steps: complete
calories or workouts cannot make a partial step count eligible. Input ordering
does not affect the result; targets are returned oldest first.

These are **retrospective examples**, not previously saved predictions. The
database contains the latest summary and its completeness flags, not historical
read timestamps or every revision. The pipeline prevents future dates and label
values from entering features, but cannot prove a particular value had actually
arrived on a historical issue date. Prospective accuracy will require saving
predictions before their target day, in a later milestone.

## Storage, retention and privacy

The service reads at most the existing 30 retained local dates, including today.
That permits at most **21** examples: 29 completed dates minus the seven-day
feature window and the excluded issue day. Missing data reduces this further.
The first sync still reads 14 completed dates plus today, yielding at most six
examples; a longer retained history accumulates with subsequent syncs.

HealthKit sync depth, SQLite schema, retention and permissions are unchanged.
Nothing is exported, uploaded, logged, trained or newly persisted. Clear Local
Data removes the source summaries; subsequent snapshots contain no experiment
until health reading is enabled again. Successful source deletions are reflected
on refresh, so derived examples cannot survive independently of their inputs.

Dates use the existing device-local calendar helpers, including DST-safe day
arithmetic. Existing stored dates/completeness reflect the writer’s time zone;
this milestone does not re-bucket old HealthKit totals after travel.

## Verification and learning

Run all checks:

```bash
npm run verify
```

Run just the forecast tests:

```bash
npm test -- --runInBand src/intelligence/__tests__/activityForecast.test.ts src/services/__tests__/activityForecast.test.ts
```

Start with the worked 1,000–7,000 step week in the unit test: its mean is 4,000
and population standard deviation is 2,000. Then inspect the leakage test, which
changes the issue day and target value while keeping the earlier features fixed.
This demonstrates the difference between **features** (known input), **label**
(outcome to learn), and **prediction** (the baseline’s estimate).

## Next milestones

1. Add an explicit, opt-in local export for a separate Python learning experiment.
2. Fit a scaled Ridge regression using earlier examples for training and later
   examples for evaluation. Fit preprocessing on training data only.
3. Compare Ridge and the mean baseline on the **same** later dates using mean
   absolute error in steps. Keep the baseline if Ridge does not improve it.
4. Integrate a validated model’s preprocessing and coefficients in TypeScript.
5. Add the experimental Dashboard card, once-per-local-day persisted forecasts,
   predicted-versus-actual history, and deletion/retention rules for those records.

Thirty days is a small experiment, not evidence of reliable forecast accuracy.
Synthetic fixtures verify pipeline behavior only. Forecasts remain separate from
goal suggestions and medical advice.
