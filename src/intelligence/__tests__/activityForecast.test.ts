import { addDaysToKey, fromDateKey } from '@/domain/dates';
import type { StoredDailySummary } from '@/domain/models';
import { buildStepForecastDataset, predictTomorrowSteps } from '../activityForecast';

const TODAY = '2026-09-30';
const now = fromDateKey(TODAY);

function day(date: string, steps: number | null, complete = true): StoredDailySummary {
  return {
    date, steps, activeCalories: null, activeMinutes: null,
    workoutCount: 0, workoutMinutes: 0, stepTarget: 8000, activityScore: null,
    complete: { steps: complete, activeCalories: false, activeMinutes: false, workouts: false },
  };
}

function history(end: string, values: (number | null)[]): StoredDailySummary[] {
  return values.map((steps, i) => day(addDaysToKey(end, i - values.length + 1), steps));
}

describe('tomorrow’s seven-day step baseline', () => {
  it('uses the seven complete calendar days before the issue date', () => {
    const summaries = history('2026-09-29', [1000, 2000, 3000, 4000, 5000, 6000, 7000]);
    expect(predictTomorrowSteps({ now, summaries })).toEqual({
      status: 'ready', method: 'baseline', modelVersion: 'mean-7d-v1',
      issuedOn: TODAY, targetDate: '2026-10-01',
      inputStart: '2026-09-23', inputEnd: '2026-09-29', observedDays: 7,
      predictedSteps: 4000,
      features: { yesterdaySteps: 7000, meanSteps7d: 4000, stdDevSteps7d: 2000, isTargetWeekend: 0 },
    });
  });

  it('keeps recorded zeroes, including an entirely zero week', () => {
    const summaries = history('2026-09-29', [0, 0, 0, 0, 0, 0, 0]);
    expect(predictTomorrowSteps({ now, summaries })).toMatchObject({
      status: 'ready', predictedSteps: 0,
      features: { yesterdaySteps: 0, meanSteps7d: 0, stdDevSteps7d: 0 },
    });
  });

  it.each([null, -1, NaN, Infinity])('excludes an invalid step observation (%s)', (value) => {
    const summaries = history('2026-09-29', [1000, 1000, value, 1000, 1000, 1000, 1000]);
    expect(predictTomorrowSteps({ now, summaries })).toMatchObject({
      status: 'insufficient-data', observedDays: 6,
    });
    expect(predictTomorrowSteps({ now, summaries })).not.toHaveProperty('predictedSteps');
  });

  it('does not fill a missing calendar date with zero or an older observation', () => {
    const summaries = history('2026-09-29', Array(8).fill(5000)).filter((row) => row.date !== '2026-09-25');
    expect(predictTomorrowSteps({ now, summaries })).toMatchObject({ status: 'insufficient-data', observedDays: 6 });
  });

  it('excludes partial step values even when another metric is complete', () => {
    const summaries = history('2026-09-29', Array(7).fill(5000));
    summaries[0]!.complete = { steps: false, activeCalories: true, activeMinutes: true, workouts: true };
    expect(predictTomorrowSteps({ now, summaries })).toMatchObject({ status: 'insufficient-data', observedDays: 6 });
  });

  it('ignores today, future records and input ordering without mutating data', () => {
    const summaries = history('2026-09-29', Array(7).fill(4000));
    const expected = predictTomorrowSteps({ now, summaries });
    const input = [...summaries, day(TODAY, 999999), day('2026-10-01', 888888)].reverse();
    const original = JSON.stringify(input);
    expect(predictTomorrowSteps({ now, summaries: input })).toEqual(expected);
    expect(JSON.stringify(input)).toBe(original);
  });

  it('withholds estimates when steps are unavailable, even with a cached week', () => {
    const summaries = history('2026-09-29', Array(7).fill(5000));
    expect(predictTomorrowSteps({ now, summaries, stepsAvailable: false })).toMatchObject({
      status: 'unavailable', observedDays: 0,
    });
  });

  it.each(['2026-10-02', '2026-10-03'])('marks a Saturday or Sunday target (%s)', (issuedOn) => {
    const summaries = history(addDaysToKey(issuedOn, -1), Array(7).fill(5000));
    expect(predictTomorrowSteps({ now: fromDateKey(issuedOn), summaries })).toMatchObject({
      status: 'ready', features: { isTargetWeekend: 1 },
    });
  });

  it.each(['2026-03-09', '2026-11-02', '2026-01-01'])('uses local calendar days across DST or year boundaries (%s)', (issuedOn) => {
    const summaries = history(addDaysToKey(issuedOn, -1), Array(7).fill(5000));
    expect(predictTomorrowSteps({ now: fromDateKey(issuedOn), summaries })).toMatchObject({
      status: 'ready', targetDate: addDaysToKey(issuedOn, 1),
      inputStart: addDaysToKey(issuedOn, -7), inputEnd: addDaysToKey(issuedOn, -1),
      predictedSteps: 5000,
    });
  });

  it('retains an unrounded mean for later fair model comparison', () => {
    const summaries = history('2026-09-29', [1, 1, 1, 1, 1, 1, 2]);
    expect(predictTomorrowSteps({ now, summaries })).toMatchObject({ status: 'ready', predictedSteps: 8 / 7 });
  });
});

describe('step forecast training dataset', () => {
  it('pairs a complete target with features available before its issue day', () => {
    const summaries = [
      ...history('2026-09-27', [1000, 2000, 3000, 4000, 5000, 6000, 7000]),
      // Sep 28 is the issue day and is intentionally absent: it was still in progress.
      day('2026-09-29', 9000), day(TODAY, 999999), day('2026-10-01', 888888),
    ];
    expect(buildStepForecastDataset({ summaries, asOf: now })).toEqual([{
      issuedOn: '2026-09-28', targetDate: '2026-09-29',
      inputStart: '2026-09-21', inputEnd: '2026-09-27',
      features: { yesterdaySteps: 7000, meanSteps7d: 4000, stdDevSteps7d: 2000, isTargetWeekend: 0 },
      actualSteps: 9000, baselineSteps: 4000,
    }]);
  });

  it('builds sorted, unique examples from 30 retained dates (21 at most)', () => {
    const summaries = history(TODAY, Array.from({ length: 30 }, (_, i) => i * 1000));
    const dataset = buildStepForecastDataset({ summaries: [...summaries].reverse(), asOf: now });
    expect(dataset).toHaveLength(21);
    expect(dataset[0]).toMatchObject({ issuedOn: '2026-09-08', targetDate: '2026-09-09', inputStart: '2026-09-01', inputEnd: '2026-09-07' });
    expect(dataset.at(-1)).toMatchObject({ issuedOn: '2026-09-28', targetDate: '2026-09-29' });
    expect(new Set(dataset.map((row) => row.targetDate)).size).toBe(dataset.length);
    expect(dataset.map((row) => row.targetDate)).toEqual(dataset.map((row) => row.targetDate).sort());
  });

  it('does not let labels or later records affect earlier features', () => {
    const summaries = history('2026-09-29', Array(9).fill(5000));
    const [before] = buildStepForecastDataset({ summaries, asOf: now });
    summaries.at(-1)!.steps = 100000;
    summaries.at(-2)!.steps = 99999; // issue day is excluded too
    const [after] = buildStepForecastDataset({ summaries, asOf: now });
    expect(after?.features).toEqual(before?.features);
    expect(after?.baselineSteps).toBe(before?.baselineSteps);
    expect(after?.actualSteps).toBe(100000);
  });

  it.each([null, -1, NaN, Infinity])('omits a missing or invalid target (%s)', (value) => {
    const summaries = history('2026-09-29', [...Array(8).fill(5000), value]);
    expect(buildStepForecastDataset({ summaries, asOf: now })).toEqual([]);
  });

  it('omits partial targets but keeps a recorded zero label', () => {
    const summaries = history('2026-09-29', [...Array(8).fill(5000), 0]);
    expect(buildStepForecastDataset({ summaries, asOf: now })[0]?.actualSteps).toBe(0);
    summaries.at(-1)!.complete.steps = false;
    expect(buildStepForecastDataset({ summaries, asOf: now })).toEqual([]);
  });

  it('omits examples with an incomplete input window', () => {
    const summaries = history('2026-09-29', Array(9).fill(5000));
    summaries[0]!.complete.steps = false;
    expect(buildStepForecastDataset({ summaries, asOf: now })).toEqual([]);
  });

  it('returns an empty dataset for empty history or unavailable steps', () => {
    expect(buildStepForecastDataset({ summaries: [], asOf: now })).toEqual([]);
    expect(buildStepForecastDataset({ summaries: history('2026-09-29', Array(9).fill(5000)), asOf: now, stepsAvailable: false })).toEqual([]);
  });
});
