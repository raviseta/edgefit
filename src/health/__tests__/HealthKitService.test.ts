import * as HK from '@kingstinct/react-native-healthkit';

import { HealthKitService } from '../HealthKitService';

/**
 * Unit tests for the real HealthKit provider's mapping logic. The native module
 * is replaced with jest fakes in this file only, so nothing touches HealthKit;
 * the fakes return the shapes the library's Swift layer produces (checked
 * against @kingstinct/react-native-healthkit 16: sums omitted for empty
 * intervals, workout duration in seconds, energy in kcal).
 */
jest.mock('@kingstinct/react-native-healthkit', () => ({
  AuthorizationRequestStatus: { unknown: 0, shouldRequest: 1, unnecessary: 2 },
  // A numeric TS enum with reverse mapping, like the generated one.
  WorkoutActivityType: { running: 37, 37: 'running', walking: 52, 52: 'walking', other: 3000, 3000: 'other' },
  isHealthDataAvailable: jest.fn(() => true),
  getRequestStatusForAuthorization: jest.fn(),
  requestAuthorization: jest.fn(() => Promise.resolve(true)),
  queryStatisticsCollectionForQuantity: jest.fn(),
  queryWorkoutSamples: jest.fn(),
}));

const mocked = HK as unknown as Record<
  | 'isHealthDataAvailable'
  | 'getRequestStatusForAuthorization'
  | 'requestAuthorization'
  | 'queryStatisticsCollectionForQuantity'
  | 'queryWorkoutSamples',
  jest.Mock
>;

const READ_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKWorkoutTypeIdentifier',
];

const bucket = (start: Date, sum?: number) => ({
  startDate: start,
  endDate: new Date(start.getTime() + 24 * 3600 * 1000),
  sources: [],
  ...(sum === undefined ? {} : { sumQuantity: { unit: 'count', quantity: sum } }),
});

beforeEach(() => {
  jest.clearAllMocks();
  mocked.isHealthDataAvailable.mockReturnValue(true);
});

describe('HealthKitService daily sums', () => {
  // Range starts mid-afternoon to prove the anchor is snapped to local midnight.
  const start = new Date(2026, 8, 28, 15, 30);
  const end = new Date(2026, 8, 30, 20, 0);

  it.each([
    ['getSteps', 'HKQuantityTypeIdentifierStepCount', 'count'],
    ['getActiveCalories', 'HKQuantityTypeIdentifierActiveEnergyBurned', 'kcal'],
    ['getActiveMinutes', 'HKQuantityTypeIdentifierAppleExerciseTime', 'min'],
  ] as const)('%s runs one daily cumulative-sum query in %s / %s', async (method, identifier, unit) => {
    mocked.queryStatisticsCollectionForQuantity.mockResolvedValue([]);
    await new HealthKitService()[method](start, end);
    expect(mocked.queryStatisticsCollectionForQuantity).toHaveBeenCalledTimes(1);
    expect(mocked.queryStatisticsCollectionForQuantity).toHaveBeenCalledWith(
      identifier,
      ['cumulativeSum'],
      new Date(2026, 8, 28),
      { day: 1 },
      { filter: { date: { startDate: start, endDate: end } }, unit },
    );
  });

  it('omits days without a sum (no data) but keeps a reported zero', async () => {
    mocked.queryStatisticsCollectionForQuantity.mockResolvedValue([
      bucket(new Date(2026, 8, 28), 5120.4),
      bucket(new Date(2026, 8, 29)),
      bucket(new Date(2026, 8, 30), 0),
    ]);
    expect(await new HealthKitService().getSteps(start, end)).toEqual([
      { date: '2026-09-28', value: 5120.4 },
      { date: '2026-09-30', value: 0 },
    ]);
  });

  it('skips buckets with no start date', async () => {
    mocked.queryStatisticsCollectionForQuantity.mockResolvedValue([
      { ...bucket(new Date(2026, 8, 30), 10), startDate: undefined },
    ]);
    expect(await new HealthKitService().getSteps(start, end)).toEqual([]);
  });

  it('keys buckets by local day across the DST fall-back (25-hour day)', async () => {
    // Tests run in America/New_York; clocks went back on 1 Nov 2026.
    mocked.queryStatisticsCollectionForQuantity.mockResolvedValue([
      bucket(new Date(2026, 9, 31), 1),
      bucket(new Date(2026, 10, 1), 2),
      bucket(new Date(2026, 10, 2), 3),
    ]);
    const result = await new HealthKitService().getSteps(new Date(2026, 9, 31), new Date(2026, 10, 2, 12));
    expect(result.map((r) => r.date)).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('propagates query failures so the sync can report the metric', async () => {
    mocked.queryStatisticsCollectionForQuantity.mockRejectedValue(new Error('Authorization not determined'));
    await expect(new HealthKitService().getActiveMinutes(start, end)).rejects.toThrow('Authorization not determined');
  });
});

describe('HealthKitService workouts', () => {
  const workout = (overrides: Record<string, unknown>) => ({
    uuid: 'w-1',
    workoutActivityType: 37,
    startDate: new Date(2026, 8, 30, 7, 30),
    duration: { unit: 's', quantity: 2520 },
    totalEnergyBurned: { unit: 'kcal', quantity: 365.4 },
    dispose: jest.fn(),
    ...overrides,
  });

  it('queries all workouts in range, newest first, and copies only the shown fields', async () => {
    const native = [
      workout({}),
      workout({ uuid: 'w-2', workoutActivityType: 52, totalEnergyBurned: undefined }),
      workout({ uuid: 'w-3', workoutActivityType: 9999, totalEnergyBurned: { unit: 'kcal', quantity: 0 } }),
    ];
    mocked.queryWorkoutSamples.mockResolvedValue(native);
    const start = new Date(2026, 8, 1);
    const end = new Date(2026, 8, 30, 20);

    const result = await new HealthKitService().getWorkouts(start, end);

    expect(mocked.queryWorkoutSamples).toHaveBeenCalledWith({
      limit: 0,
      ascending: false,
      filter: { date: { startDate: start, endDate: end } },
    });
    expect(result).toEqual([
      { id: 'w-1', activityType: 'running', startDate: new Date(2026, 8, 30, 7, 30), durationSeconds: 2520, energyKcal: 365.4 },
      { id: 'w-2', activityType: 'walking', startDate: new Date(2026, 8, 30, 7, 30), durationSeconds: 2520 },
      { id: 'w-3', activityType: 'other', startDate: new Date(2026, 8, 30, 7, 30), durationSeconds: 2520 },
    ]);
    // Native HKWorkout objects are released once copied.
    for (const w of native) expect(w.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('HealthKitService authorization', () => {
  it('requests read-only access to exactly the four documented types', async () => {
    expect(await new HealthKitService().requestAuthorization()).toEqual({ status: 'requested' });
    expect(mocked.requestAuthorization).toHaveBeenCalledWith({ toRead: READ_TYPES });
    expect(mocked.requestAuthorization.mock.calls[0][0]).not.toHaveProperty('toShare');
  });

  it('does not prompt when HealthKit is unavailable', async () => {
    mocked.isHealthDataAvailable.mockReturnValue(false);
    expect(await new HealthKitService().requestAuthorization()).toMatchObject({ status: 'unavailable' });
    expect(mocked.requestAuthorization).not.toHaveBeenCalled();
  });

  it('reports unavailable instead of crashing when the native module throws', async () => {
    mocked.isHealthDataAvailable.mockImplementation(() => {
      throw new Error('native module missing');
    });
    expect(await new HealthKitService().isAvailable()).toBe(false);
  });

  it.each([
    [2, 'requested'],
    [1, 'shouldRequest'],
    [0, 'unknown'],
  ])('maps request status %i to %s, checking read types only', async (native, expected) => {
    mocked.getRequestStatusForAuthorization.mockResolvedValue(native);
    expect(await new HealthKitService().getPermissionRequestStatus()).toBe(expected);
    expect(mocked.getRequestStatusForAuthorization).toHaveBeenCalledWith({ toRead: READ_TYPES });
  });
});
