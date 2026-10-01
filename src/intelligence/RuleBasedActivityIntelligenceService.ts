import { toDateKey } from '@/domain/dates';
import type { ActivityData, ActivityInsight, InsightType } from '@/domain/models';
import { formatNumber } from '@/lib/format';
import type { ActivityIntelligenceService } from './ActivityIntelligenceService';
import {
  BASELINE_WINDOW_DAYS,
  CONSISTENT_DAYS_REQUIRED,
  extractActivityFeatures,
  MIN_BASELINE_DAYS,
} from './features';

/**
 * Deterministic, rule-based insights. This is explicitly *not* machine
 * learning: every insight maps to a documented threshold below, and the same
 * input always yields the same output.
 *
 * Insights are ordered by priority; the Dashboard shows the first one.
 */
export const ABOVE_AVERAGE_RATIO = 1.1;
export const ON_TRACK_RATIO = 0.9;

export class RuleBasedActivityIntelligenceService implements ActivityIntelligenceService {
  readonly method = 'rule-based' as const;

  constructor(private readonly now: () => Date = () => new Date()) {}

  async generateInsights(activityData: ActivityData[]): Promise<ActivityInsight[]> {
    const now = this.now();
    const date = toDateKey(now);
    const f = extractActivityFeatures(activityData, date);
    const insights: ActivityInsight[] = [];
    const add = (type: InsightType, title: string, message: string) =>
      insights.push({ id: `${type}:${date}`, type, title, message, generatedAt: now.toISOString() });

    if (f.todaySteps === null && f.todayActiveMinutes === null) {
      add(
        'no-activity-yet',
        'No activity recorded yet today',
        'Once your phone or watch records steps or exercise today, your summary will appear here.',
      );
    }

    if (f.baselineDays >= MIN_BASELINE_DAYS && f.todayStepsRatio !== null && f.baselineAvgSteps !== null) {
      const percent = Math.round(f.todayStepsRatio * 100);
      const usual = formatNumber(f.baselineAvgSteps);
      if (f.todayStepsRatio >= ABOVE_AVERAGE_RATIO) {
        add(
          'above-average',
          'Above your usual level',
          `You're more active today than your ${BASELINE_WINDOW_DAYS}-day average: ${formatNumber(f.todaySteps!)} steps compared with a typical ${usual}.`,
        );
      } else if (f.todayStepsRatio >= ON_TRACK_RATIO) {
        add(
          'on-track',
          'Right around your usual level',
          `You're at ${percent}% of your usual daily steps (${usual}). You're tracking close to your typical day.`,
        );
      } else {
        add(
          'below-average',
          'Below your usual level so far',
          `You're at ${percent}% of your usual daily activity level so far today. A short walk later could help you reach your typical ${usual} steps.`,
        );
      }
    }

    if (
      f.todayActiveMinutes !== null &&
      f.yesterdayActiveMinutes !== null &&
      f.todayActiveMinutes > f.yesterdayActiveMinutes
    ) {
      add(
        'more-active-minutes-than-yesterday',
        'More active minutes than yesterday',
        `You've completed ${f.todayActiveMinutes} active minutes today, compared with ${f.yesterdayActiveMinutes} yesterday.`,
      );
    }

    if (f.consistentDays >= CONSISTENT_DAYS_REQUIRED) {
      add(
        'consistent-week',
        'Consistent week',
        `Your activity has been consistent over the last ${BASELINE_WINDOW_DAYS} days: ${f.consistentDays} days were within 25% of your average.`,
      );
    }

    if (f.baselineDays < MIN_BASELINE_DAYS) {
      add(
        'building-baseline',
        'Building your baseline',
        `EdgeFit compares today with your recent days. ${f.baselineDays} of ${MIN_BASELINE_DAYS} days of step history so far — personalized comparisons will start soon.`,
      );
    }

    return insights;
  }
}
