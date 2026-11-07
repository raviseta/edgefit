import {
  AuthorizationRequestStatus,
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryStatisticsCollectionForQuantity,
  queryWorkoutSamples,
  requestAuthorization,
  WorkoutActivityType,
  type IntervalComponents,
  type QuantityTypeIdentifier,
} from '@kingstinct/react-native-healthkit';

import { startOfDay, toDateKey } from '@/domain/dates';
import type { HourlySteps } from '@/domain/models';
import type {
  ActiveMinuteData,
  AuthorizationResult,
  CalorieData,
  DailyQuantity,
  HealthService,
  PermissionRequestStatus,
  StepData,
  WorkoutData,
} from './HealthService';
import { sumByLocalHour } from './normalization';

/** Read-only access. EdgeFit never writes to HealthKit. */
const READ_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKWorkoutTypeIdentifier',
] as const;

/**
 * HealthKit implementation. Uses statistics-collection queries so HealthKit
 * returns one de-duplicated sum per day (iPhone + Watch overlap is resolved
 * by HealthKit), instead of loading individual samples into JS.
 */
export class HealthKitService implements HealthService {
  readonly provider = 'healthkit' as const;

  async isAvailable() {
    try {
      return isHealthDataAvailable();
    } catch {
      return false;
    }
  }

  async getPermissionRequestStatus(): Promise<PermissionRequestStatus> {
    const status = await getRequestStatusForAuthorization({ toRead: READ_TYPES });
    switch (status) {
      case AuthorizationRequestStatus.unnecessary:
        return 'requested';
      case AuthorizationRequestStatus.shouldRequest:
        return 'shouldRequest';
      default:
        return 'unknown';
    }
  }

  async requestAuthorization(): Promise<AuthorizationResult> {
    if (!(await this.isAvailable())) {
      return { status: 'unavailable', reason: 'HealthKit is not available on this device' };
    }
    // Resolves once the sheet is dismissed. HealthKit does not disclose whether
    // read access was granted, so "requested" is the most we can honestly report.
    await requestAuthorization({ toRead: READ_TYPES });
    return { status: 'requested' };
  }

  getSteps(startDate: Date, endDate: Date): Promise<StepData[]> {
    return this.dailySum('HKQuantityTypeIdentifierStepCount', 'count', startDate, endDate);
  }

  async getHourlySteps(startDate: Date, endDate: Date): Promise<HourlySteps[]> {
    const buckets = await this.sums('HKQuantityTypeIdentifierStepCount', 'count', startDate, endDate, { hour: 1 });
    return sumByLocalHour(buckets);
  }

  getActiveCalories(startDate: Date, endDate: Date): Promise<CalorieData[]> {
    return this.dailySum('HKQuantityTypeIdentifierActiveEnergyBurned', 'kcal', startDate, endDate);
  }

  getActiveMinutes(startDate: Date, endDate: Date): Promise<ActiveMinuteData[]> {
    return this.dailySum('HKQuantityTypeIdentifierAppleExerciseTime', 'min', startDate, endDate);
  }

  async getWorkouts(startDate: Date, endDate: Date): Promise<WorkoutData[]> {
    const workouts = await queryWorkoutSamples({
      limit: 0,
      ascending: false,
      filter: { date: { startDate, endDate } },
    });

    return workouts.map((workout) => {
      const data: WorkoutData = {
        id: workout.uuid,
        activityType: WorkoutActivityType[workout.workoutActivityType] ?? 'other',
        startDate: new Date(workout.startDate),
        durationSeconds: workout.duration.quantity,
      };
      const energy = workout.totalEnergyBurned?.quantity;
      if (energy !== undefined && energy > 0) data.energyKcal = energy;
      // Release the native HKWorkout; only the plain fields above are kept.
      workout.dispose();
      return data;
    });
  }

  private async dailySum(
    identifier: QuantityTypeIdentifier,
    unit: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyQuantity[]> {
    const buckets = await this.sums(identifier, unit, startDate, endDate, { day: 1 });
    return buckets.map(({ start, value }) => ({ date: toDateKey(start), value }));
  }

  /** One cumulative sum per interval, anchored at local midnight. Empty intervals are left out. */
  private async sums(
    identifier: QuantityTypeIdentifier,
    unit: string,
    startDate: Date,
    endDate: Date,
    interval: IntervalComponents,
  ): Promise<{ start: Date; value: number }[]> {
    const buckets = await queryStatisticsCollectionForQuantity(
      identifier,
      ['cumulativeSum'],
      startOfDay(startDate),
      interval,
      { filter: { date: { startDate, endDate } }, unit: unit as never },
    );

    const result: { start: Date; value: number }[] = [];
    for (const bucket of buckets) {
      // A bucket with no samples has no sumQuantity: that is "no data", not zero.
      if (!bucket.startDate || bucket.sumQuantity === undefined) continue;
      result.push({ start: new Date(bucket.startDate), value: bucket.sumQuantity.quantity });
    }
    return result;
  }
}
