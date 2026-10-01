import { indexByDate, normalizeWorkout, workoutTypeLabel } from '../normalization';

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
