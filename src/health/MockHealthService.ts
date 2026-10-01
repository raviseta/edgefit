import { addDays, startOfDay, toDateKey } from '@/domain/dates';
import type { HealthFixture } from './fixtures';
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
