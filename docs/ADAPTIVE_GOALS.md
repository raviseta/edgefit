# Adaptive activity goals

An optional daily step goal, set by hand or by accepting a local, rule-based suggestion.
Goals change only when the user chooses to change them.

Implementation: [`src/domain/stepGoals.ts`](../src/domain/stepGoals.ts) ·
[`src/services/ActivityService.ts`](../src/services/ActivityService.ts) (`updateStepGoal`) ·
Tests: [`src/domain/__tests__/stepGoals.test.ts`](../src/domain/__tests__/stepGoals.test.ts),
[`src/services/__tests__/stepGoals.test.ts`](../src/services/__tests__/stepGoals.test.ts)

## Suggestion rules (`steps-median-v1`)

| Step | Rule |
| --- | --- |
| Window | The 14 complete local days before today. Today is never used. |
| Valid day | A day whose step count is marked complete (read fresh after the day ended). A recorded 0 counts; a missing day does not. |
| Coverage | At least 10 valid days, otherwise "Suggestions need 10 valid days out of 14". |
| Baseline | Median steps of the valid days. A median of 0 gives no suggestion. |
| Suggested goal | Baseline + 5%, rounded to the nearest 250. |
| Cap | With a goal already set, an increase is capped at 10% of it (rounded down to 250). |
| No suggestion | The current goal is above the baseline, or the change is under 250 steps. |

Suggestions are paused when:

- the goal was set manually (until the user changes it again),
- the user chose **Not now** (until 8 days after the last day of the window, i.e. a week of
  new complete days),
- insights are off, health reading is off, or the latest sync could not read steps.

An accepted suggestion must still match the data it was calculated from: the suggestion
carries an in-memory token of its inputs, and accepting it after a sync changed them fails
with "Activity changed".

## How a goal is used

- **Progress** – the Dashboard shows today's steps as a percentage of the goal, only while
  steps are freshly synced.
- **Activity Score** – the goal is the steps target of the score; without a goal it is 8,000.
  See [ACTIVITY_SCORE.md](ACTIVITY_SCORE.md#step-goal-and-stored-scores).
- **Goal streak** – the number of days in a row whose complete step count reached the goal,
  ending yesterday, plus today once today reaches it (today can't break the streak). A day
  with an unknown or incomplete step count ends the streak rather than being skipped. Shown
  on the Dashboard goal card and as a chip on the 30-day calendar.

## Storage

Goal preferences are one JSON value in the `settings` table (key `stepGoalPreferences`):
the goal, its source (`manual` or `accepted_suggestion`), when it was set, and the
dismissal date. Nothing else is persisted; suggestions are recalculated on every read.
Corrupt values fall back to "no goal". Clear Local Data deletes them with everything else.

Goal edits share the queue with syncs and Clear Local Data, so an edit started before a
clear fails with "Local data changed" instead of restoring the goal afterwards.

## Device checks

1. Run with the `twoWeeks` mock scenario
   (`EXPO_PUBLIC_HEALTH_PROVIDER=mock EXPO_PUBLIC_MOCK_SCENARIO=twoWeeks npx expo run:ios`):
   the goal card shows a suggestion; accepting it sets the goal and the score breakdown
   shows it as the steps target.
2. **Not now** hides the suggestion and keeps "No daily goal set".
3. **Set manually** with 5000 on the `normal` scenario: the card shows the progress bar, the
   goal streak, and "Your manual goal stays in place".
4. Settings → Clear Local Data: the goal and streak are gone.
