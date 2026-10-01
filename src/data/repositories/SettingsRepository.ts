import { DEFAULT_SETTINGS, type AppSettings } from '@/domain/models';
import type { Database } from '../Database';

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];

/** Key/value settings store. Values are JSON-encoded; unknown or corrupt values fall back to defaults. */
export class SettingsRepository {
  constructor(private readonly db: Database) {}

  async get(): Promise<AppSettings> {
    const rows = await this.db.getAll<{ key: string; value: string }>('SELECT key, value FROM settings');
    const settings: AppSettings = { ...DEFAULT_SETTINGS };
    for (const { key, value } of rows) {
      if (!(KEYS as string[]).includes(key)) continue;
      const k = key as keyof AppSettings;
      try {
        const parsed: unknown = JSON.parse(value);
        if (typeof parsed === typeof DEFAULT_SETTINGS[k]) {
          (settings as unknown as Record<string, unknown>)[k] = parsed;
        }
      } catch {
        // Corrupt value: keep the default.
      }
    }
    if (settings.energyUnit !== 'kcal' && settings.energyUnit !== 'kJ') {
      settings.energyUnit = DEFAULT_SETTINGS.energyUnit;
    }
    return settings;
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    await this.db.transaction(async () => {
      for (const key of KEYS) {
        if (patch[key] === undefined) continue;
        await this.db.run(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          [key, JSON.stringify(patch[key])],
        );
      }
    });
    return this.get();
  }

  async clear(): Promise<void> {
    await this.db.run('DELETE FROM settings');
  }
}
