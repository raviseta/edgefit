import type { ActivityData, ActivityInsight, HourlySteps } from '@/domain/models';

/**
 * Boundary between the app and whatever produces personalized insights.
 *
 * MVP: RuleBasedActivityIntelligenceService (deterministic rules, no ML).
 * Future: an OnDeviceMLActivityIntelligenceService can implement this same
 * interface, consuming `extractActivityFeatures()` output as model input,
 * without changes to the UI, repositories or sync pipeline.
 */
export interface ActivityIntelligenceService {
  /** How insights are produced; surfaced in the Privacy Center so the UI never overstates it. */
  readonly method: 'rule-based' | 'on-device-ml';

  /** `hourlySteps` covers the baseline days when available; it is used in memory only. */
  generateInsights(activityData: ActivityData[], hourlySteps?: HourlySteps[]): Promise<ActivityInsight[]>;
}
