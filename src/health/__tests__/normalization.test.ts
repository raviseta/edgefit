import { indexByDate, normalizeWorkout, sumByLocalHour, workoutTypeLabel } from '../normalization';

describe('workoutTypeLabel', () => {
  it.each([
    ['running', 'Running'],
    ['crossCountrySkiing', 'Cross Country Skiing'],
    ['traditionalStrengthTraining', 'Strength Training'],
    ['highIntensityIntervalTraining', 'HIIT'],
    ['other', 'Workout'],
    ['', 'Workout'],
  ])('%s -> %s', (input, expected) => {
    expect(workoutTypeLabel(input)).toBe(expected);
  });
});

describe('normalizeWorkout', () => {
  const start = new Date(2026, 8, 30, 7, 30);

  it('converts seconds to rounded minutes and keeps calories', () => {
    expect(
      normalizeWorkout({ id: 'w1', activityType: 'running', startDate: start, durationSeconds: 2530, energyKcal: 364.6 }),
    ).toEqual({ id: 'w1', type: 'Running', startDate: start.toISOString(), durationMinutes: 42, calories: 365 });
  });

  it('omits calories when absent or invalid', () => {
    expect(normalizeWorkout({ id: 'w2', activityType: 'walking', startDate: start, durationSeconds: 60 })).not.toHaveProperty('calories');
    expect(
      normalizeWorkout({ id: 'w3', activityType: 'walking', startDate: start, durationSeconds: 60, energyKcal: 0 }),
    ).not.toHaveProperty('calories');
  });
});

describe('indexByDate', () => {
  it('sums by date and drops negatives', () => {
    const map = indexByDate([
      { date: 'a', value: 1 },
      { date: 'a', value: 2 },
      { date: 'b', value: -1 },
    ]);
    expect([...map.entries()]).toEqual([['a', 3]]);
  });
});

describe('sumByLocalHour', () => {
  it('adds the repeated hour together when clocks go back', () => {
    // 1 Nov 2026 in New York: 01:00 EDT and then 01:00 EST.
    const result = sumByLocalHour([
      { start: new Date('2026-11-01T05:00:00Z'), value: 100 },
      { start: new Date('2026-11-01T06:00:00Z'), value: 50 },
      { start: new Date('2026-11-01T07:00:00Z'), value: 20 },
    ]);
    expect(result).toEqual([
      { date: '2026-11-01', hour: 1, steps: 150 },
      { date: '2026-11-01', hour: 2, steps: 20 },
    ]);
  });

  it('drops invalid values and sorts by day and hour', () => {
    const result = sumByLocalHour([
      { start: new Date(2026, 8, 30, 9), value: 10 },
      { start: new Date(2026, 8, 29, 18), value: 30 },
      { start: new Date(2026, 8, 29, 8), value: -5 },
      { start: new Date(2026, 8, 29, 7), value: NaN },
    ]);
    expect(result).toEqual([
      { date: '2026-09-29', hour: 18, steps: 30 },
      { date: '2026-09-30', hour: 9, steps: 10 },
    ]);
  });
});
