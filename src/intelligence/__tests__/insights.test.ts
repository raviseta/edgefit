import { buildActivityData } from '@/domain/aggregation';
import { lastNDayKeys, lastNDaysRange } from '@/domain/dates';
import type { ActivityData } from '@/domain/models';
import { fixtures, type HealthFixture } from '@/health/fixtures';
import { MockHealthService } from '@/health/MockHealthService';
import { TEST_NOW, testNow } from '@/test-utils/harness';
import { extractActivityFeatures } from '../features';
import { RuleBasedActivityIntelligenceService } from '../RuleBasedActivityIntelligenceService';

async function activityFor(fixture: HealthFixture): Promise<ActivityData[]> {
  const health = new MockHealthService(fixture, { now: testNow });
  const { start, end } = lastNDaysRange(8, TEST_NOW);
  return buildActivityData(lastNDayKeys(8, TEST_NOW), {
    steps: await health.getSteps(start, end),
    activeCalories: await health.getActiveCalories(start, end),
    activeMinutes: await health.getActiveMinutes(start, end),
  });
}

const service = new RuleBasedActivityIntelligenceService(testNow);
const typesFor = async (fixture: HealthFixture) => (await service.generateInsights(await activityFor(fixture))).map((i) => i.type);

describe('extractActivityFeatures', () => {
  it('computes the 7-day baseline excluding today', async () => {
    const f = extractActivityFeatures(await activityFor(fixtures.normal), '2026-09-30');
    expect(f.baselineDays).toBe(7);
    expect(f.baselineAvgSteps).toBeCloseTo(61070 / 7);
    expect(f.todaySteps).toBe(6420);
    expect(f.todayStepsRatio).toBeCloseTo(6420 / (61070 / 7));
    expect(f.yesterdayActiveMinutes).toBe(39);
    expect(f.consistentDays).toBe(7);
  });

  it('handles gaps in history', async () => {
    const f = extractActivityFeatures(await activityFor(fixtures.missingMetrics), '2026-09-30');
    expect(f.baselineDays).toBe(4);
    expect(f.baselineAvgSteps).toBe(7925);
    expect(f.todayActiveMinutes).toBeNull();
  });

  it('returns nulls when there is no data', () => {
    const f = extractActivityFeatures([], '2026-09-30');
    expect(f).toMatchObject({ todaySteps: null, baselineDays: 0, baselineAvgSteps: null, todayStepsRatio: null, consistentDays: 0 });
  });
});

describe('RuleBasedActivityIntelligenceService', () => {
  it('identifies itself as rule-based, not ML', () => {
    expect(service.method).toBe('rule-based');
  });

  it('normal activity: below usual so far today, consistent week', async () => {
    const insights = await service.generateInsights(await activityFor(fixtures.normal));
    expect(insights.map((i) => i.type)).toEqual(['below-average', 'consistent-week']);
    expect(insights[0]!.message).toBe(
      "You're at 74% of your usual daily activity level so far today. A short walk later could help you reach your typical 8,724 steps.",
    );
  });

  it('high activity: above average and more active minutes than yesterday', async () => {
    expect(await typesFor(fixtures.high)).toEqual(['above-average', 'more-active-minutes-than-yesterday', 'consistent-week']);
  });

  it('low activity: below average', async () => {
    expect((await typesFor(fixtures.low))[0]).toBe('below-average');
  });

  it('missing metrics: still compares steps, skips minute comparison', async () => {
    expect(await typesFor(fixtures.missingMetrics)).toEqual(['below-average']);
  });

  it('empty data: says so honestly and explains the baseline', async () => {
    const insights = await service.generateInsights(await activityFor(fixtures.empty));
    expect(insights.map((i) => i.type)).toEqual(['no-activity-yet', 'building-baseline']);
    expect(insights[1]!.message).toContain('0 of 3 days');
  });

  it('on track when within 10% of the usual level', async () => {
    const days: ActivityData[] = lastNDayKeys(8, TEST_NOW).map((date) => ({
      date,
      steps: 8000,
      activeCalories: null,
      activeMinutes: null,
    }));
    days[7]!.steps = 7600;
    expect((await service.generateInsights(days))[0]!.type).toBe('on-track');
  });

  it('is deterministic and produces stable ids', async () => {
    const data = await activityFor(fixtures.high);
    expect(await service.generateInsights(data)).toEqual(await service.generateInsights(data));
    expect((await service.generateInsights(data))[0]!.id).toBe('above-average:2026-09-30');
  });

  it('never uses AI/ML or medical language', async () => {
    for (const fixture of Object.values(fixtures)) {
      for (const insight of await service.generateInsights(await activityFor(fixture))) {
        const text = `${insight.title} ${insight.message}`;
        expect(text).not.toMatch(/\b(AI|machine learning|predict|diagnos|medical|health risk)\b/i);
      }
    }
  });
});
