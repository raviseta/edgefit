/**
 * Domain models. These are platform-independent: nothing here knows about
 * HealthKit, Health Connect, SQLite or React Native.
 *
 * Metric fields are `number | null`. `null` means "the health platform reported
 * no data for this metric on this day", which is different from a measured 0.
 * The UI must never render a `null` as a zero.
 */

/** Local calendar day in `YYYY-MM-DD` form. */
export type DateKey = string;

export interface ActivityData {
  date: DateKey;
  steps: number | null;
  activeCalories: number | null;
  activeMinutes: number | null;
}

export interface DailySummary extends ActivityData {
  workoutCount: number;
  /** Total workout duration that day; feeds the "workout activity" score component. */
  workoutMinutes: number;
  /** 0–100, or `null` when there is not enough data to score the day. */
  activityScore: number | null;
}

export interface Workout {
  id: string;
  /** Human-readable workout type, e.g. "Running". */
  type: string;
  /** ISO-8601 timestamp. */
  startDate: string;
  durationMinutes: number;
  /** Kilocalories, when the source recorded them. */
  calories?: number;
}

export type InsightType =
  | 'building-baseline'
  | 'no-activity-yet'
  | 'above-average'
  | 'on-track'
  | 'below-average'
  | 'more-active-minutes-than-yesterday'
  | 'consistent-week';

export interface ActivityInsight {
  id: string;
  type: InsightType;
  title: string;
  message: string;
  /** ISO-8601 timestamp. */
  generatedAt: string;
}

export interface PrivacySettings {
  /** User allowed EdgeFit to read health data (onboarding / settings choice). */
  healthDataEnabled: boolean;
  /** Generate local, rule-based insights. This is not telemetry: nothing is sent anywhere. */
  analyticsEnabled: boolean;
}

export type EnergyUnit = 'kcal' | 'kJ';

export interface AppSettings extends PrivacySettings {
  onboardingCompleted: boolean;
  /** Whether the system health permission prompt has been shown at least once. */
  healthPermissionRequested: boolean;
  energyUnit: EnergyUnit;
}

export const DEFAULT_SETTINGS: AppSettings = {
  onboardingCompleted: false,
  healthDataEnabled: false,
  analyticsEnabled: true,
  healthPermissionRequested: false,
  energyUnit: 'kcal',
};

export function hasAnyMetric(day: ActivityData): boolean {
  return day.steps !== null || day.activeCalories !== null || day.activeMinutes !== null;
}
