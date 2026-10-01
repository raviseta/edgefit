import type { DateKey } from '@/domain/models';

/**
 * Platform-independent boundary to a health data store (HealthKit today,
 * Health Connect later). Implementations return *daily aggregates* rather than
 * raw samples so that raw health records never enter the app's memory or
 * storage unnecessarily.
 */

export interface DailyQuantity {
  /** Local calendar day the value belongs to. */
  date: DateKey;
  value: number;
}

export type StepData = DailyQuantity;
/** Active energy, kilocalories. */
export type CalorieData = DailyQuantity;
/** Exercise minutes (Apple "Exercise" ring minutes on iOS). */
export type ActiveMinuteData = DailyQuantity;

export interface WorkoutData {
  id: string;
  /** Normalized activity key, e.g. "running", "traditionalStrengthTraining". */
  activityType: string;
  startDate: Date;
  durationSeconds: number;
  /** Kilocalories, when recorded. */
  energyKcal?: number;
}

export type HealthProviderKind = 'healthkit' | 'mock';

/**
 * Result of asking the OS for read access.
 *
 * On iOS, HealthKit deliberately hides whether *read* access was granted, so
 * the best the app can know is that the prompt was shown ("requested").
 */
export type AuthorizationResult =
  | { status: 'requested' }
  | { status: 'denied' }
  | { status: 'unavailable'; reason: string };

/** Whether the OS permission prompt still needs to be shown. */
export type PermissionRequestStatus = 'shouldRequest' | 'requested' | 'unknown';

export interface HealthService {
  readonly provider: HealthProviderKind;

  isAvailable(): Promise<boolean>;
  getPermissionRequestStatus(): Promise<PermissionRequestStatus>;
  requestAuthorization(): Promise<AuthorizationResult>;

  getSteps(startDate: Date, endDate: Date): Promise<StepData[]>;
  getActiveCalories(startDate: Date, endDate: Date): Promise<CalorieData[]>;
  getActiveMinutes(startDate: Date, endDate: Date): Promise<ActiveMinuteData[]>;
  getWorkouts(startDate: Date, endDate: Date): Promise<WorkoutData[]>;
}

/** Health data types EdgeFit reads. Shown verbatim in onboarding and the Privacy Center. */
export const HEALTH_DATA_TYPES = [
  { key: 'steps', label: 'Steps' },
  { key: 'activeEnergy', label: 'Active energy' },
  { key: 'exerciseMinutes', label: 'Exercise minutes' },
  { key: 'workouts', label: 'Workouts' },
] as const;
