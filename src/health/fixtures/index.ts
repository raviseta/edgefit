/**
 * Deterministic health fixtures for development, tests, UI previews and CI.
 * Days are expressed as offsets from "today" (0 = today, -1 = yesterday) so
 * a fixture renders identically for any fixed clock.
 */

export interface FixtureDay {
  offset: number;
  steps?: number;
  activeCalories?: number;
  activeMinutes?: number;
}

export interface FixtureWorkout {
  id: string;
  offset: number;
  /** Local start time. */
  hour: number;
  minute: number;
  activityType: string;
  durationMinutes: number;
  energyKcal?: number;
}

export interface HealthFixture {
  name: HealthScenario;
  days: FixtureDay[];
  workouts: FixtureWorkout[];
}

export type HealthScenario = 'empty' | 'normal' | 'high' | 'low' | 'missingMetrics' | 'multipleWorkouts' | 'twoWeeks';

const week = (rows: [steps: number, kcal: number, minutes: number][]): FixtureDay[] =>
  rows.map(([steps, activeCalories, activeMinutes], i) => ({
    offset: i - (rows.length - 1),
    steps,
    activeCalories,
    activeMinutes,
  }));

export const emptyFixture: HealthFixture = { name: 'empty', days: [], workouts: [] };

/** Typical week; today is partially complete (afternoon). */
export const normalFixture: HealthFixture = {
  name: 'normal',
  days: week([
    [9120, 410, 41],
    [7840, 365, 33],
    [10230, 480, 52],
    [8650, 402, 38],
    [6980, 318, 27],
    [9410, 436, 47],
    [8840, 398, 39],
    [6420, 296, 34],
  ]),
  workouts: [
    { id: 'wk-normal-1', offset: 0, hour: 7, minute: 30, activityType: 'running', durationMinutes: 42, energyKcal: 365 },
    { id: 'wk-normal-2', offset: -1, hour: 18, minute: 10, activityType: 'walking', durationMinutes: 31, energyKcal: 142 },
    { id: 'wk-normal-3', offset: -3, hour: 12, minute: 5, activityType: 'traditionalStrengthTraining', durationMinutes: 48, energyKcal: 210 },
    { id: 'wk-normal-4', offset: -5, hour: 6, minute: 45, activityType: 'cycling', durationMinutes: 55 },
  ],
};

export const highFixture: HealthFixture = {
  name: 'high',
  days: week([
    [14200, 720, 88],
    [16850, 810, 95],
    [13900, 690, 79],
    [15400, 760, 91],
    [18100, 905, 112],
    [12750, 640, 74],
    [15020, 745, 86],
    [17360, 860, 102],
  ]),
  workouts: [
    { id: 'wk-high-1', offset: 0, hour: 6, minute: 15, activityType: 'running', durationMinutes: 64, energyKcal: 610 },
    { id: 'wk-high-2', offset: 0, hour: 17, minute: 40, activityType: 'highIntensityIntervalTraining', durationMinutes: 25, energyKcal: 280 },
    { id: 'wk-high-3', offset: -1, hour: 7, minute: 0, activityType: 'cycling', durationMinutes: 90, energyKcal: 720 },
    { id: 'wk-high-4', offset: -2, hour: 6, minute: 30, activityType: 'swimming', durationMinutes: 45, energyKcal: 400 },
  ],
};

export const lowFixture: HealthFixture = {
  name: 'low',
  days: week([
    [3100, 120, 8],
    [2650, 98, 5],
    [4020, 160, 12],
    [2980, 110, 6],
    [3550, 140, 9],
    [2200, 85, 3],
    [3300, 125, 7],
    [1150, 42, 2],
  ]),
  workouts: [],
};

/** Gaps: some days absent entirely, some days missing individual metrics. */
export const missingMetricsFixture: HealthFixture = {
  name: 'missingMetrics',
  days: [
    { offset: -7, steps: 8200, activeCalories: 390, activeMinutes: 36 },
    { offset: -6, steps: 7600 },
    // -5 and -4: no data at all (e.g. phone left at home, watch not worn)
    { offset: -3, activeCalories: 280 },
    { offset: -2, steps: 9100, activeMinutes: 41 },
    { offset: -1, steps: 6800, activeCalories: 300 },
    { offset: 0, steps: 3400 },
  ],
  workouts: [],
};

export const multipleWorkoutsFixture: HealthFixture = {
  name: 'multipleWorkouts',
  days: normalFixture.days,
  workouts: [
    { id: 'wk-multi-1', offset: 0, hour: 6, minute: 0, activityType: 'running', durationMinutes: 35, energyKcal: 330 },
    { id: 'wk-multi-2', offset: 0, hour: 12, minute: 30, activityType: 'yoga', durationMinutes: 20, energyKcal: 70 },
    { id: 'wk-multi-3', offset: 0, hour: 18, minute: 15, activityType: 'traditionalStrengthTraining', durationMinutes: 40, energyKcal: 190 },
    { id: 'wk-multi-4', offset: -1, hour: 7, minute: 10, activityType: 'cycling', durationMinutes: 60, energyKcal: 480 },
    { id: 'wk-multi-5', offset: -1, hour: 19, minute: 0, activityType: 'walking', durationMinutes: 25 },
    { id: 'wk-multi-6', offset: -4, hour: 8, minute: 0, activityType: 'swimming', durationMinutes: 30, energyKcal: 260 },
  ],
};

/**
 * Two full weeks before today (plus a partial today), for the weekly
 * Personal Activity Insights. The last 7 complete days average 9,000 steps,
 * the 7 days before them 8,000 (+13%), with workouts on 3 of the last 7 days.
 */
export const twoWeeksFixture: HealthFixture = {
  name: 'twoWeeks',
  days: week([
    [7600, 350, 30],
    [8400, 380, 34],
    [8200, 372, 33],
    [7300, 330, 28],
    [8900, 410, 40],
    [7800, 356, 31],
    [7800, 352, 30],
    [9500, 440, 46],
    [8100, 370, 33],
    [10400, 488, 55],
    [8600, 395, 37],
    [9200, 420, 44],
    [7900, 362, 31],
    [9300, 428, 45],
    [5200, 240, 22],
  ]),
  workouts: [
    { id: 'wk-two-1', offset: 0, hour: 7, minute: 0, activityType: 'running', durationMinutes: 30, energyKcal: 280 },
    { id: 'wk-two-2', offset: -1, hour: 7, minute: 15, activityType: 'running', durationMinutes: 38, energyKcal: 340 },
    { id: 'wk-two-3', offset: -1, hour: 18, minute: 30, activityType: 'yoga', durationMinutes: 25, energyKcal: 80 },
    { id: 'wk-two-4', offset: -4, hour: 12, minute: 0, activityType: 'traditionalStrengthTraining', durationMinutes: 45, energyKcal: 200 },
    { id: 'wk-two-5', offset: -7, hour: 6, minute: 40, activityType: 'cycling', durationMinutes: 50, energyKcal: 410 },
    { id: 'wk-two-6', offset: -10, hour: 17, minute: 0, activityType: 'swimming', durationMinutes: 35, energyKcal: 300 },
  ],
};

export const fixtures: Record<HealthScenario, HealthFixture> = {
  empty: emptyFixture,
  normal: normalFixture,
  high: highFixture,
  low: lowFixture,
  missingMetrics: missingMetricsFixture,
  multipleWorkouts: multipleWorkoutsFixture,
  twoWeeks: twoWeeksFixture,
};

export function isHealthScenario(value: unknown): value is HealthScenario {
  return typeof value === 'string' && value in fixtures;
}
