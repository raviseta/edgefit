import type { DailySummary, Workout } from '../models';
import { buildCalendarDays, CALENDAR_DAYS, isCalendarEmpty, scoreLevel, summarizeCalendar } from '../calendar';

// Tests run with TZ=America/New_York (see package.json).
const summary = (date: string, overrides: Partial<DailySummary> = {}): DailySummary => ({
  date,
  steps: 5000,
  activeCalories: 250,
  activeMinutes: 20,
  workoutCount: 0,
  workoutMinutes: 0,
  activityScore: 45,
  ...overrides,
});

const workout = (id: string, start: Date): Workout => ({
  id,
  type: 'Running',
  startDate: start.toISOString(),
  durationMinutes: 30,
});

describe('buildCalendarDays: dates', () => {
  it('produces exactly 30 consecutive local dates ending today', () => {
    const days = buildCalendarDays(new Date(2026, 9, 17, 9, 0), [], []);
    expect(days).toHaveLength(CALENDAR_DAYS);
    expect(days[0]!.date).toBe('2026-09-18');
    expect(days.at(-1)!.date).toBe('2026-10-17');
    expect(new Set(days.map((d) => d.date)).size).toBe(30);
    expect(days.filter((d) => d.isToday).map((d) => d.date)).toEqual(['2026-10-17']);
  });

  it('crosses month and year boundaries', () => {
    const days = buildCalendarDays(new Date(2026, 0, 10, 12), [], []).map((d) => d.date);
    expect(days[0]).toBe('2025-12-12');
    expect(days).toContain('2025-12-31');
    expect(days).toContain('2026-01-01');
    expect(days.at(-1)).toBe('2026-01-10');
  });

  it('handles leap-year February', () => {
    const days = buildCalendarDays(new Date(2028, 2, 1, 8), [], []).map((d) => d.date);
    expect(days.slice(-3)).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
  });

  it.each([
    ['DST end (25-hour day)', new Date(2026, 10, 1, 23, 30), '2026-10-03', '2026-11-01'],
    ['the day after DST ends', new Date(2026, 10, 2, 0, 15), '2026-10-04', '2026-11-02'],
    ['DST start (23-hour day)', new Date(2026, 2, 8, 23, 59), '2026-02-07', '2026-03-08'],
  ])('stays 30 distinct dates across %s', (_label, now, first, last) => {
    const days = buildCalendarDays(now, [], []).map((d) => d.date);
    expect(days).toHaveLength(30);
    expect(new Set(days).size).toBe(30);
    expect(days[0]).toBe(first);
    expect(days.at(-1)).toBe(last);
  });

  it('ignores stored data outside the 30-day window', () => {
    const days = buildCalendarDays(new Date(2026, 9, 17, 9), [summary('2026-09-17'), summary('2026-10-18')], []);
    expect(days.every((d) => d.summary === null)).toBe(true);
  });
});

describe('buildCalendarDays: joining stored data', () => {
  it('maps each local day to its summary and the workouts that started that day', () => {
    const now = new Date(2026, 9, 17, 20);
    const lateNight = workout('late', new Date(2026, 9, 16, 23, 45));
    const morning = workout('morning', new Date(2026, 9, 17, 6, 30));
    const evening = workout('evening', new Date(2026, 9, 17, 18, 0));
    const days = buildCalendarDays(now, [summary('2026-10-17', { workoutCount: 2 })], [lateNight, morning, evening]);
    const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
    expect(byDate['2026-10-17']!.summary).toMatchObject({ date: '2026-10-17', workoutCount: 2 });
    expect(byDate['2026-10-17']!.workouts.map((w) => w.id)).toEqual(['evening', 'morning']);
    expect(byDate['2026-10-16']!.workouts.map((w) => w.id)).toEqual(['late']);
    expect(byDate['2026-10-16']!.summary).toBeNull();
  });

  it('keeps an unknown score distinct from a valid zero', () => {
    const days = buildCalendarDays(
      new Date(2026, 9, 17, 9),
      [
        summary('2026-10-15', { steps: 0, activeMinutes: 0, activityScore: 0 }),
        summary('2026-10-16', { steps: null, activeMinutes: null, activeCalories: 120, activityScore: null }),
      ],
      [],
    );
    const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
    expect(byDate['2026-10-15']).toMatchObject({ score: 0, level: 'zero' });
    expect(byDate['2026-10-16']).toMatchObject({ score: null, level: 'unknown' });
    expect(byDate['2026-10-17']).toMatchObject({ summary: null, score: null, level: 'unknown' });
  });
});

describe('scoreLevel', () => {
  it.each([
    [null, 'unknown'],
    [Number.NaN, 'unknown'],
    [0, 'zero'],
    [1, 1],
    [24, 1],
    [25, 2],
    [49, 2],
    [50, 3],
    [74, 3],
    [75, 4],
    [100, 4],
  ] as const)('%p → %p', (score, level) => {
    expect(scoreLevel(score)).toBe(level);
  });
});

describe('summarizeCalendar', () => {
  const now = new Date(2026, 9, 17, 9);

  it('empty history: no coverage, no average, no best day', () => {
    const days = buildCalendarDays(now, [], []);
    expect(summarizeCalendar(days)).toEqual({ totalDays: 30, scoredDays: 0, averageScore: null, best: null, streak: 0 });
    expect(isCalendarEmpty(days)).toBe(true);
  });

  it('averages valid scores only and never counts unknown days as zero', () => {
    const days = buildCalendarDays(
      now,
      [
        summary('2026-10-10', { activityScore: 80 }),
        summary('2026-10-11', { activityScore: 0 }),
        summary('2026-10-12', { activityScore: 40 }),
        summary('2026-10-13', { activityScore: null, steps: null, activeMinutes: null }),
      ],
      [],
    );
    const result = summarizeCalendar(days);
    expect(result.scoredDays).toBe(3);
    expect(result.averageScore).toBe(40);
    expect(result.best).toEqual({ date: '2026-10-10', score: 80 });
  });

  it('best day ties go to the most recent date', () => {
    const days = buildCalendarDays(
      now,
      [summary('2026-10-01', { activityScore: 92 }), summary('2026-10-09', { activityScore: 92 })],
      [],
    );
    expect(summarizeCalendar(days).best).toEqual({ date: '2026-10-09', score: 92 });
  });

  it('a valid zero is a real scored day', () => {
    const days = buildCalendarDays(now, [summary('2026-10-17', { activityScore: 0 })], []);
    expect(summarizeCalendar(days)).toEqual({
      totalDays: 30,
      scoredDays: 1,
      averageScore: 0,
      best: { date: '2026-10-17', score: 0 },
      streak: 1,
    });
  });

  it('streak counts consecutive scored days ending today', () => {
    const days = buildCalendarDays(
      now,
      ['2026-10-12', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'].map((d) => summary(d)),
      [],
    );
    expect(summarizeCalendar(days).streak).toBe(4);
  });

  it('an unscored today (still in progress) does not break the streak; an unscored past day does', () => {
    const scoredThroughYesterday = buildCalendarDays(now, [summary('2026-10-15'), summary('2026-10-16')], []);
    expect(summarizeCalendar(scoredThroughYesterday).streak).toBe(2);
    const gapYesterday = buildCalendarDays(now, [summary('2026-10-15'), summary('2026-10-17')], []);
    expect(summarizeCalendar(gapYesterday).streak).toBe(1);
    const unknownYesterday = buildCalendarDays(
      now,
      [summary('2026-10-15'), summary('2026-10-16', { activityScore: null, steps: null, activeMinutes: null })],
      [],
    );
    expect(summarizeCalendar(unknownYesterday).streak).toBe(0);
  });

  it('a valid zero keeps the streak going (it is a real, recorded day)', () => {
    const days = buildCalendarDays(now, [summary('2026-10-16', { activityScore: 0 }), summary('2026-10-17')], []);
    expect(summarizeCalendar(days).streak).toBe(2);
  });

  it('a stored day with only null metrics still counts as empty; a workout alone does not', () => {
    const nullDay = summary('2026-10-17', { steps: null, activeCalories: null, activeMinutes: null, activityScore: null });
    expect(isCalendarEmpty(buildCalendarDays(now, [nullDay], []))).toBe(true);
    expect(isCalendarEmpty(buildCalendarDays(now, [], [workout('w', new Date(2026, 9, 5, 7))]))).toBe(false);
  });
});
