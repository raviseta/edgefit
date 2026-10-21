import { addDaysToKey, toDateKey } from '@/domain/dates';
import type { DateKey, StoredDailySummary, Workout } from '@/domain/models';
import {
  buildPersonalInsights,
  type PersonalInsights,
  type PersonalInsightsInput,
} from '../personalInsights';
import { TEST_NOW } from '@/test-utils/harness';

// TEST_NOW is Wed 30 Sep 2026, 20:00. Current week: Sep 23–29. Previous week: Sep 16–22.
const TODAY = '2026-09-30';
const CURRENT = Array.from({ length: 7 }, (_, i) => addDaysToKey('2026-09-23', i));
const PREVIOUS = Array.from({ length: 7 }, (_, i) => addDaysToKey('2026-09-16', i));

const ALL_COMPLETE = { steps: true, activeCalories: true, activeMinutes: true, workouts: true };
const NONE_COMPLETE = { steps: false, activeCalories: false, activeMinutes: false, workouts: false };

/** A row whose metrics were all saved after its day ended, unless `complete` says otherwise. */
function row(date: DateKey, metrics: Partial<StoredDailySummary> = {}): StoredDailySummary {
  return {
    date,
    steps: null,
    activeCalories: null,
    activeMinutes: null,
    workoutCount: 0,
    workoutMinutes: 0,
    activityScore: null,
    complete: ALL_COMPLETE,
    ...metrics,
  };
}

function workout(id: string, start: Date, durationMinutes = 30): Workout {
  return { id, type: 'Running', startDate: start.toISOString(), durationMinutes };
}

const steps = (dates: DateKey[], values: (number | null)[]) => dates.map((d, i) => row(d, { steps: values[i] ?? null }));

function build(input: Partial<PersonalInsightsInput>): PersonalInsights {
  return buildPersonalInsights({ now: TEST_NOW, summaries: [], workouts: [], ...input });
}

function allText(insights: PersonalInsights): string {
  return [insights.activityConsistency, insights.weeklySteps, insights.exerciseFrequency]
    .map((r) => (r.status === 'eligible' ? [r.card.title, r.card.observation, r.card.period, ...r.card.details, r.card.explanation].join(' ') : r.message))
    .join(' ');
}

describe('buildPersonalInsights', () => {
  it('complete history: all three insights with exact values and periods', () => {
    const summaries = [
      ...steps(PREVIOUS, [7600, 8400, 8200, 7300, 8900, 7800, 7800]),
      ...steps(CURRENT, [9500, 8100, 10400, 8600, 9200, 7900, 9300]),
    ];
    const workouts = [
      workout('a', new Date(2026, 8, 29, 7)),
      workout('b', new Date(2026, 8, 29, 18)),
      workout('c', new Date(2026, 8, 26, 12)),
      workout('d', new Date(2026, 8, 23, 6)),
    ];
    const insights = build({ summaries, workouts });

    expect(insights.hasAnyHistory).toBe(true);
    expect(insights.activityConsistency).toMatchObject({
      status: 'eligible',
      activeDays: 7,
      observedDays: 7,
      period: { start: '2026-09-23', end: '2026-09-29', label: 'Sep 23 – Sep 29' },
    });
    expect(insights.weeklySteps).toMatchObject({
      status: 'eligible',
      direction: 'increased',
      current: { validDays: 7, averageSteps: 9000, period: { start: '2026-09-23', end: '2026-09-29' } },
      previous: { validDays: 7, averageSteps: 8000, period: { start: '2026-09-16', end: '2026-09-22' } },
    });
    expect(insights.weeklySteps.status === 'eligible' && insights.weeklySteps.percentChange).toBeCloseTo(0.125);
    expect(insights.exerciseFrequency).toMatchObject({ status: 'eligible', workoutDays: 3, workoutCount: 4 });

    if (insights.weeklySteps.status !== 'eligible') throw new Error('expected eligible');
    expect(insights.weeklySteps.card).toEqual({
      title: 'Weekly steps',
      observation: 'Your recorded steps increased compared with the previous week.',
      period: 'Sep 23 – Sep 29 vs Sep 16 – Sep 22',
      details: [
        'Last 7 days: 9,000 steps a day on average (7 of 7 days with steps).',
        'Week before: 8,000 steps a day on average (7 of 7 days with steps).',
        'Change: +13%.',
      ],
      explanation: expect.stringContaining('not counted as zero'),
    });
  });

  it('a recorded zero is a valid day; missing data is not', () => {
    const summaries = [
      ...steps(PREVIOUS, [5000, 5000, 5000, 5000, 5000, null, null]),
      // Two recorded zeros, two missing days.
      ...steps(CURRENT, [0, 0, 6000, 6000, 6000, null, null]),
    ];
    const insights = build({ summaries });

    // Mean over the 5 valid days only: (0 + 0 + 18000) / 5.
    expect(insights.weeklySteps).toMatchObject({ status: 'eligible', current: { validDays: 5, averageSteps: 3600 } });
    // Zero-step days are observed but not active; missing days are neither.
    expect(insights.activityConsistency).toMatchObject({ status: 'eligible', activeDays: 3, observedDays: 5 });
    if (insights.activityConsistency.status !== 'eligible') throw new Error('expected eligible');
    // Missing days stay out of the denominator, so the headline can't read as 4 inactive days.
    expect(insights.activityConsistency.card.observation).toBe('You recorded activity on 3 of 5 days with data in the last 7 days.');
    expect(insights.activityConsistency.card.details).toEqual([]);
  });

  it.each([
    ['current', [5000, 5000, 5000, 5000, 5000], [6000, 6000, 6000, 6000, null, null, null], 4, 5],
    ['previous', [5000, 5000, 5000, 5000, null], [6000, 6000, 6000, 6000, 6000, 6000, 6000], 7, 4],
  ])('suppresses the step comparison when the %s week has fewer than 5 valid days', (_label, prev, cur, curDays, prevDays) => {
    const insights = build({ summaries: [...steps(PREVIOUS, prev), ...steps(CURRENT, cur)] });
    expect(insights.weeklySteps).toMatchObject({
      status: 'ineligible',
      reason: 'insufficient-data',
      current: { validDays: curDays },
      previous: { validDays: prevDays },
    });
    if (insights.weeklySteps.status !== 'ineligible') throw new Error('expected ineligible');
    expect(insights.weeklySteps.message).toContain(`last 7 days: ${curDays}, week before: ${prevDays}`);
  });

  it('a previous-week average of zero gives no percentage', () => {
    const insights = build({
      summaries: [...steps(PREVIOUS, [0, 0, 0, 0, 0, 0, 0]), ...steps(CURRENT, [1000, 1000, 1000, 1000, 1000])],
    });
    expect(insights.weeklySteps).toMatchObject({ status: 'eligible', direction: 'increased', percentChange: null });
    if (insights.weeklySteps.status !== 'eligible') throw new Error('expected eligible');
    expect(insights.weeklySteps.card.details.at(-1)).toBe(
      'No percentage change is shown because the week before averaged 0 steps.',
    );
    expect(allText(insights)).not.toMatch(/NaN|Infinity/);
  });

  it('two zero weeks are "about the same", without dividing by zero', () => {
    const insights = build({ summaries: [...steps(PREVIOUS, [0, 0, 0, 0, 0]), ...steps(CURRENT, [0, 0, 0, 0, 0])] });
    expect(insights.weeklySteps).toMatchObject({ status: 'eligible', direction: 'unchanged', percentChange: null });
  });

  it.each([
    [10000, 10040, 'unchanged', '0%', 'were about the same as'],
    [10000, 9960, 'unchanged', '0%', 'were about the same as'],
    [10000, 10060, 'increased', '+1%', 'increased compared with'],
    [8000, 6000, 'decreased', '−25%', 'decreased compared with'],
  ])('rounds only for display: %d → %d is %s (%s)', (prev, cur, direction, percent, phrase) => {
    const insights = build({
      summaries: [...steps(PREVIOUS, Array(7).fill(prev)), ...steps(CURRENT, Array(7).fill(cur))],
    });
    if (insights.weeklySteps.status !== 'eligible') throw new Error('expected eligible');
    expect(insights.weeklySteps.direction).toBe(direction);
    expect(insights.weeklySteps.percentChange).toBeCloseTo((cur - prev) / prev, 10);
    expect(insights.weeklySteps.card.details.at(-1)).toBe(`Change: ${percent}.`);
    expect(insights.weeklySteps.card.observation).toContain(phrase);
  });

  it('several workouts on one day count as one workout day; sub-minute workouts are ignored', () => {
    const insights = build({
      summaries: steps(CURRENT, Array(7).fill(5000)),
      workouts: [
        workout('a', new Date(2026, 8, 28, 6)),
        workout('b', new Date(2026, 8, 28, 12)),
        workout('c', new Date(2026, 8, 28, 19)),
        workout('tiny', new Date(2026, 8, 25, 9), 0),
      ],
    });
    expect(insights.exerciseFrequency).toMatchObject({ status: 'eligible', workoutDays: 1, workoutCount: 3 });
    if (insights.exerciseFrequency.status !== 'eligible') throw new Error('expected eligible');
    expect(insights.exerciseFrequency.card.observation).toBe('You recorded workouts on 1 different day in the last 7 days.');
    expect(insights.exerciseFrequency.card.details).toEqual(['3 workouts in total.']);
  });

  it('reports zero workout days only as "none recorded"', () => {
    const insights = build({ summaries: steps(CURRENT, Array(7).fill(5000)) });
    expect(insights.exerciseFrequency).toMatchObject({ status: 'eligible', workoutDays: 0, workoutCount: 0 });
    if (insights.exerciseFrequency.status !== 'eligible') throw new Error('expected eligible');
    expect(insights.exerciseFrequency.card.observation).toBe('No workouts were recorded in the last 7 days.');
    expect(insights.exerciseFrequency.card.explanation).toContain("isn't included");
  });

  it('respects local midnight: workouts just inside and outside the window', () => {
    const insights = build({
      summaries: steps(CURRENT, Array(7).fill(5000)),
      workouts: [
        workout('last-minute-of-window', new Date(2026, 8, 29, 23, 59)),
        workout('first-minute-of-window', new Date(2026, 8, 23, 0, 1)),
        workout('today', new Date(2026, 8, 30, 0, 1)),
        workout('previous-week', new Date(2026, 8, 22, 23, 59)),
      ],
    });
    expect(insights.exerciseFrequency).toMatchObject({ status: 'eligible', workoutDays: 2, workoutCount: 2 });
  });

  it("excludes today's partial data", () => {
    const base = [...steps(PREVIOUS, Array(7).fill(8000)), ...steps(CURRENT, Array(7).fill(8000))];
    const withToday = [
      ...base,
      { ...row(TODAY, { steps: 50000, activeMinutes: 300 }), complete: NONE_COMPLETE },
    ];
    const todayWorkout = [workout('today', new Date(2026, 8, 30, 7))];
    expect(build({ summaries: withToday, workouts: todayWorkout })).toEqual(build({ summaries: base }));
  });

  it('a day saved before it ended is partial and does not count', () => {
    const summaries = [...steps(PREVIOUS, Array(7).fill(8000)), ...steps(CURRENT, Array(7).fill(8000))];
    // Sep 29 was last saved at 09:00 on Sep 29 (the app was not opened again until now).
    const partial = summaries.findIndex((s) => s.date === '2026-09-29');
    summaries[partial] = { ...summaries[partial]!, steps: 1200, complete: NONE_COMPLETE };
    const insights = build({ summaries });

    expect(insights.weeklySteps).toMatchObject({ current: { validDays: 6, averageSteps: 8000 } });
    expect(insights.activityConsistency).toMatchObject({ activeDays: 6, observedDays: 6 });
    // Late workouts on that day might not be cached yet.
    expect(insights.exerciseFrequency).toMatchObject({ status: 'ineligible', reason: 'incomplete-window' });
  });

  it.each([
    // US DST ends Sun 1 Nov 2026 (25-hour day); starts Sun 8 Mar 2026 (23-hour day).
    ['fall back', new Date(2026, 10, 3, 12), '2026-11-01', 'Oct 27 – Nov 2', 'Oct 20 – Oct 26'],
    ['spring forward', new Date(2026, 2, 10, 12), '2026-03-08', 'Mar 3 – Mar 9', 'Feb 24 – Mar 2'],
  ])('uses local calendar days across the DST %s transition', (_label, now, dstDay, currentLabel, previousLabel) => {
    const today = toDateKey(now);
    const cur = Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i - 7));
    const prev = Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i - 14));
    const summaries = [...steps(prev, Array(7).fill(5000)), ...steps(cur, Array(7).fill(6000))];
    const insights = buildPersonalInsights({ now, summaries, workouts: [] });

    expect(insights.weeklySteps).toMatchObject({
      status: 'eligible',
      current: { validDays: 7, period: { label: currentLabel } },
      previous: { validDays: 7, period: { label: previousLabel } },
    });
    expect(cur.includes(dstDay) || prev.includes(dstDay)).toBe(true);
  });

  it('is deterministic for identical inputs', () => {
    const input = {
      summaries: [...steps(PREVIOUS, [1, 2, 3, 4, 5, 6, 7]), ...steps(CURRENT, [7, 6, 5, 4, 3, 2, 1])],
      workouts: [workout('a', new Date(2026, 8, 24, 8))],
    };
    expect(build(input)).toEqual(build(input));
    expect(build({ ...input, summaries: [...input.summaries].reverse() })).toEqual(build(input));
  });

  it('empty history: nothing eligible and no fabricated content', () => {
    const nullRows = [...PREVIOUS, ...CURRENT].map((d) => row(d));
    for (const insights of [build({}), build({ summaries: nullRows })]) {
      expect(insights.hasAnyHistory).toBe(false);
      expect(insights.activityConsistency.status).toBe('ineligible');
      expect(insights.weeklySteps.status).toBe('ineligible');
    }
    // With no rows at all the window was never synced, so workouts aren't claimed either.
    expect(build({}).exerciseFrequency).toMatchObject({ status: 'ineligible', reason: 'incomplete-window' });
  });

  it('a metric that is only partial holds back just the insights that use it', () => {
    const summaries = [...steps(PREVIOUS, Array(7).fill(8000)), ...steps(CURRENT, Array(7).fill(8000))];
    const sep29 = summaries.findIndex((s) => s.date === '2026-09-29');
    const workouts = [workout('a', new Date(2026, 8, 24, 8))];

    // Workouts failed to sync after Sep 29 ended; steps were read fresh.
    summaries[sep29] = { ...summaries[sep29]!, complete: { ...ALL_COMPLETE, workouts: false } };
    let insights = build({ summaries, workouts });
    expect(insights.weeklySteps).toMatchObject({ status: 'eligible', current: { validDays: 7 } });
    expect(insights.exerciseFrequency).toMatchObject({ status: 'ineligible', reason: 'incomplete-window' });

    // Steps failed instead; workouts were read fresh.
    summaries[sep29] = { ...summaries[sep29]!, complete: { ...ALL_COMPLETE, steps: false } };
    insights = build({ summaries, workouts });
    expect(insights.weeklySteps).toMatchObject({ status: 'eligible', current: { validDays: 6 } });
    expect(insights.exerciseFrequency).toMatchObject({ status: 'eligible', workoutDays: 1 });
  });

  it.each([
    [7, 7, 'You recorded activity on 7 of the last 7 days.'],
    [5, 5, 'You recorded activity on all 5 days with data in the last 7 days.'],
    [3, 5, 'You recorded activity on 3 of 5 days with data in the last 7 days.'],
    [1, 1, 'You recorded activity on the only day with data in the last 7 days.'],
    [0, 1, 'No activity was recorded on the only day with data in the last 7 days.'],
  ])('describes %i active of %i observed days', (active, observed, text) => {
    const values = CURRENT.map((_, i) => (i < observed ? (i < active ? 5000 : 0) : null));
    const insights = build({ summaries: steps(CURRENT, values) });
    if (insights.activityConsistency.status !== 'eligible') throw new Error('expected eligible');
    expect(insights.activityConsistency.card.observation).toBe(text);
  });

  it('never uses medical, causal or AI language', () => {
    const summaries = [...steps(PREVIOUS, Array(7).fill(8000)), ...steps(CURRENT, Array(7).fill(9000))];
    const text = allText(build({ summaries, workouts: [workout('a', new Date(2026, 8, 24, 8))] }));
    expect(text).not.toMatch(/\b(AI|machine learning|predict|diagnos|medical|health risk|because of EdgeFit|significant)\b/i);
  });
});
