import { addDays, startOfDay, toDateKey } from '@/domain/dates';
import type { HourlySteps } from '@/domain/models';
import { HOURLY_STEP_PROFILE, type HealthFixture } from './fixtures';
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

export interface MockHealthServiceOptions {
  /** Fixed clock so fixtures resolve to stable dates. Defaults to the real clock. */
  now?: () => Date;
  authorization?: 'granted' | 'denied' | 'unavailable';
  /** Make every data query reject, for exercising error states. */
  failQueries?: boolean;
}

/**
 * Deterministic, fixture-backed HealthService for development, tests, UI
 * previews, Android (until Health Connect lands) and CI. Never reads real data.
 */
export class MockHealthService implements HealthService {
  readonly provider = 'mock' as const;
  private requested = false;

  constructor(
    private readonly fixture: HealthFixture,
    private readonly options: MockHealthServiceOptions = {},
  ) {}

  async isAvailable() {
    return this.options.authorization !== 'unavailable';
  }

  async getPermissionRequestStatus(): Promise<PermissionRequestStatus> {
    return this.requested ? 'requested' : 'shouldRequest';
  }

  async requestAuthorization(): Promise<AuthorizationResult> {
    this.requested = true;
    switch (this.options.authorization ?? 'granted') {
      case 'denied':
        return { status: 'denied' };
      case 'unavailable':
        return { status: 'unavailable', reason: 'Mock provider configured as unavailable' };
      default:
        return { status: 'requested' };
    }
  }

  getSteps(startDate: Date, endDate: Date): Promise<StepData[]> {
    return this.daily('steps', startDate, endDate);
  }

  /**
   * Spreads each fixture day's steps over `HOURLY_STEP_PROFILE`. Today's total is "so far",
   * so it is spread over the hours up to the current one only.
   */
  async getHourlySteps(startDate: Date, endDate: Date): Promise<HourlySteps[]> {
    this.assertQueryable();
    const now = this.now();
    const today = startOfDay(now);
    const result: HourlySteps[] = [];
    for (const day of this.fixture.days) {
      if (day.steps === undefined) continue;
      const date = addDays(today, day.offset);
      if (date < startOfDay(startDate) || date > endDate) continue;
      const lastHour = day.offset === 0 ? now.getHours() : 23;
      spreadOverHours(day.steps, lastHour).forEach((steps, hour) => {
        if (steps > 0) result.push({ date: toDateKey(date), hour, steps });
      });
    }
    return result;
  }

  getActiveCalories(startDate: Date, endDate: Date): Promise<CalorieData[]> {
    return this.daily('activeCalories', startDate, endDate);
  }

  getActiveMinutes(startDate: Date, endDate: Date): Promise<ActiveMinuteData[]> {
    return this.daily('activeMinutes', startDate, endDate);
  }

  async getWorkouts(startDate: Date, endDate: Date): Promise<WorkoutData[]> {
    this.assertQueryable();
    const today = startOfDay(this.now());
    return this.fixture.workouts
      .map((w) => {
        const start = addDays(today, w.offset);
        start.setHours(w.hour, w.minute, 0, 0);
        const data: WorkoutData = {
          id: w.id,
          activityType: w.activityType,
          startDate: start,
          durationSeconds: w.durationMinutes * 60,
        };
        if (w.energyKcal !== undefined) data.energyKcal = w.energyKcal;
        return data;
      })
      .filter((w) => w.startDate >= startDate && w.startDate <= endDate)
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  }

  private async daily(
    metric: 'steps' | 'activeCalories' | 'activeMinutes',
    startDate: Date,
    endDate: Date,
  ): Promise<DailyQuantity[]> {
    this.assertQueryable();
    const today = startOfDay(this.now());
    const result: DailyQuantity[] = [];
    for (const day of this.fixture.days) {
      const value = day[metric];
      if (value === undefined) continue;
      const date = addDays(today, day.offset);
      if (date < startOfDay(startDate) || date > endDate) continue;
      result.push({ date: toDateKey(date), value });
    }
    return result;
  }

  private assertQueryable() {
    if (this.options.failQueries) {
      throw new Error('Mock health query failure');
    }
  }

  private now() {
    return this.options.now?.() ?? new Date();
  }
}

/** Whole steps per hour 0…lastHour in proportion to the profile, summing exactly to `total`. */
function spreadOverHours(total: number, lastHour: number): number[] {
  const weights = HOURLY_STEP_PROFILE.slice(0, lastHour + 1);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum === 0) return weights.map((_, hour) => (hour === lastHour ? total : 0));
  const steps = weights.map((w) => Math.floor((total * w) / weightSum));
  const busiest = weights.indexOf(Math.max(...weights));
  steps[busiest]! += total - steps.reduce((a, b) => a + b, 0);
  return steps;
}
