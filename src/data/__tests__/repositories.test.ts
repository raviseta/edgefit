import { DEFAULT_SETTINGS, type DailySummary, type Workout } from '@/domain/models';
import { NodeSqliteDatabase } from '@/test-utils/NodeSqliteDatabase';
import { migrate, SCHEMA_VERSION } from '../migrations';
import { createRepositories } from '../repositories';

async function setup() {
  const db = new NodeSqliteDatabase();
  await migrate(db);
  return { db, repos: createRepositories(db) };
}

const summary = (date: string, overrides: Partial<DailySummary> = {}): DailySummary => ({
  date,
  steps: 5000,
  activeCalories: 250,
  activeMinutes: 20,
  workoutCount: 0,
  workoutMinutes: 0,
  activityScore: 45,
  ...overrides,
});

const workout = (id: string, startDate: Date, overrides: Partial<Workout> = {}): Workout => ({
  id,
  type: 'Running',
  startDate: startDate.toISOString(),
  durationMinutes: 30,
  ...overrides,
});

describe('migrations', () => {
  it('applies the schema once and is idempotent', async () => {
    const db = new NodeSqliteDatabase();
    await migrate(db);
    await migrate(db);
    expect(await db.getFirst<{ user_version: number }>('PRAGMA user_version')).toEqual({ user_version: SCHEMA_VERSION });
  });
});

describe('SummaryRepository', () => {
  it('upserts and reads a range in date order', async () => {
    const { repos } = await setup();
    await repos.summaries.upsertMany([summary('2026-09-30'), summary('2026-09-28')]);
    await repos.summaries.upsertMany([summary('2026-09-30', { steps: 9000 })]);
    const range = await repos.summaries.getRange('2026-09-28', '2026-09-30');
    expect(range.map((s) => [s.date, s.steps])).toEqual([
      ['2026-09-28', 5000],
      ['2026-09-30', 9000],
    ]);
  });

  it('round-trips null metrics without turning them into zeros', async () => {
    const { repos } = await setup();
    const s = summary('2026-09-30', { steps: null, activeCalories: null, activeMinutes: null, activityScore: null });
    await repos.summaries.upsertMany([s]);
    expect(await repos.summaries.getByDate('2026-09-30')).toEqual(s);
  });

  it('deletes rows older than a cutoff', async () => {
    const { repos } = await setup();
    await repos.summaries.upsertMany([summary('2026-08-01'), summary('2026-09-30')]);
    await repos.summaries.deleteBefore('2026-09-01');
    expect((await repos.summaries.getRange('2000-01-01', '2100-01-01')).map((s) => s.date)).toEqual(['2026-09-30']);
  });
});

describe('WorkoutRepository', () => {
  it('replaces workouts within a range, mirroring deletions at the source', async () => {
    const { repos } = await setup();
    const start = new Date(2026, 8, 1);
    const end = new Date(2026, 8, 30, 23);
    await repos.workouts.replaceRange(start, end, [
      workout('a', new Date(2026, 8, 10)),
      workout('b', new Date(2026, 8, 20), { calories: 300 }),
    ]);
    await repos.workouts.replaceRange(start, end, [workout('b', new Date(2026, 8, 20), { calories: 300 })]);
    expect(await repos.workouts.list()).toEqual([workout('b', new Date(2026, 8, 20), { calories: 300 })]);
  });

  it('keeps workouts outside the replaced range and lists newest first', async () => {
    const { repos } = await setup();
    await repos.workouts.replaceRange(new Date(2026, 7, 1), new Date(2026, 7, 31), [workout('old', new Date(2026, 7, 15))]);
    await repos.workouts.replaceRange(new Date(2026, 8, 1), new Date(2026, 8, 30), [workout('new', new Date(2026, 8, 15))]);
    expect((await repos.workouts.list()).map((w) => w.id)).toEqual(['new', 'old']);
  });

  it('omits calories when not recorded', async () => {
    const { repos } = await setup();
    await repos.workouts.replaceRange(new Date(2026, 8, 1), new Date(2026, 8, 30), [workout('x', new Date(2026, 8, 2))]);
    expect((await repos.workouts.list())[0]).not.toHaveProperty('calories');
  });
});

describe('InsightRepository', () => {
  it('replaces the stored set and preserves priority order', async () => {
    const { repos } = await setup();
    const insight = (id: string) => ({
      id,
      type: 'on-track' as const,
      title: id,
      message: 'm',
      generatedAt: '2026-09-30T12:00:00.000Z',
    });
    await repos.insights.replaceAll([insight('z'), insight('a')]);
    expect((await repos.insights.list()).map((i) => i.id)).toEqual(['z', 'a']);
    await repos.insights.replaceAll([]);
    expect(await repos.insights.list()).toEqual([]);
  });
});

describe('SettingsRepository / privacy settings', () => {
  it('returns privacy-preserving defaults on first launch', async () => {
    const { repos } = await setup();
    const settings = await repos.settings.get();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings.healthDataEnabled).toBe(false);
  });

  it('persists partial updates', async () => {
    const { repos } = await setup();
    await repos.settings.update({ healthDataEnabled: true, energyUnit: 'kJ' });
    await repos.settings.update({ analyticsEnabled: false });
    expect(await repos.settings.get()).toEqual({
      ...DEFAULT_SETTINGS,
      healthDataEnabled: true,
      analyticsEnabled: false,
      energyUnit: 'kJ',
    });
  });

  it('falls back to defaults for corrupt or mistyped values', async () => {
    const { db, repos } = await setup();
    await db.run("INSERT INTO settings (key, value) VALUES ('healthDataEnabled', 'not json')");
    await db.run(`INSERT INTO settings (key, value) VALUES ('analyticsEnabled', '"yes"')`);
    await db.run(`INSERT INTO settings (key, value) VALUES ('energyUnit', '"furlongs"')`);
    expect(await repos.settings.get()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('clearAll', () => {
  it('wipes every EdgeFit table', async () => {
    const { db, repos } = await setup();
    await repos.summaries.upsertMany([summary('2026-09-30')]);
    await repos.workouts.replaceRange(new Date(2026, 8, 1), new Date(2026, 8, 30), [workout('a', new Date(2026, 8, 2))]);
    await repos.settings.update({ onboardingCompleted: true });
    await repos.clearAll();
    for (const table of ['daily_summaries', 'workouts', 'insights', 'settings']) {
      expect(await db.getFirst<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)).toEqual({ n: 0 });
    }
    expect(await repos.settings.get()).toEqual(DEFAULT_SETTINGS);
  });
});
