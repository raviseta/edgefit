import { calculateActivityScore, SCORE_TARGETS } from '../activityScore';

describe('calculateActivityScore', () => {
  it('awards 100 when every target is met', () => {
    expect(calculateActivityScore({ steps: 8000, activeMinutes: 30, workoutMinutes: 30 })).toEqual({
      total: 100,
      breakdown: { steps: 40, activeMinutes: 30, workout: 30 },
    });
  });

  it('caps each component at its weight', () => {
    expect(calculateActivityScore({ steps: 40000, activeMinutes: 300, workoutMinutes: 240 })?.total).toBe(100);
  });

  it('weights components 40/30/30 proportionally', () => {
    // 4,000 steps = half of steps target -> 20; 15 min -> 15; 0 workout -> 0
    expect(calculateActivityScore({ steps: 4000, activeMinutes: 15, workoutMinutes: 0 })).toEqual({
      total: 35,
      breakdown: { steps: 20, activeMinutes: 15, workout: 0 },
    });
  });

  it('rounds the total to an integer and the breakdown to one decimal', () => {
    // 6,420 steps -> 32.1; 34 min -> 30; 42 workout min -> 30
    expect(calculateActivityScore({ steps: 6420, activeMinutes: 34, workoutMinutes: 42 })).toEqual({
      total: 92,
      breakdown: { steps: 32.1, activeMinutes: 30, workout: 30 },
    });
  });

  it('returns null when there is no data at all', () => {
    expect(calculateActivityScore({ steps: null, activeMinutes: null, workoutMinutes: 0 })).toBeNull();
  });

  it('treats a missing metric as zero when other data exists', () => {
    expect(calculateActivityScore({ steps: SCORE_TARGETS.steps, activeMinutes: null, workoutMinutes: 0 })?.total).toBe(40);
    expect(calculateActivityScore({ steps: null, activeMinutes: null, workoutMinutes: 30 })?.total).toBe(30);
  });

  it('scores a measured zero-activity day as 0, not null', () => {
    expect(calculateActivityScore({ steps: 0, activeMinutes: 0, workoutMinutes: 0 })?.total).toBe(0);
  });

  it('ignores invalid negative or non-finite inputs', () => {
    expect(calculateActivityScore({ steps: -500, activeMinutes: Number.NaN, workoutMinutes: -10 })?.total).toBe(0);
  });
});
