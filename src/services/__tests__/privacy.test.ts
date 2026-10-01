import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Guardrails for the privacy claims made in the Privacy Center and README:
 * no network APIs in app code and no analytics/ads/tracking dependencies.
 */
const SRC = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' || name === 'test-utils' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('privacy guardrails', () => {
  it('app code makes no network requests', () => {
    const offenders = sourceFiles(SRC).filter((file) =>
      /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('ships no analytics, advertising or tracking SDKs', () => {
    const pkg = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const banned = /analytics|segment|amplitude|mixpanel|firebase|sentry|bugsnag|datadog|appsflyer|adjust|branch|admob|facebook|posthog|expo-updates|axios/i;
    expect(deps.filter((d) => banned.test(d))).toEqual([]);
  });

  it('requests read-only HealthKit access', () => {
    const app = JSON.parse(readFileSync(join(SRC, '..', 'app.json'), 'utf8'));
    const plugin = app.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === '@kingstinct/react-native-healthkit');
    expect(plugin[1].NSHealthUpdateUsageDescription).toBe(false);
    expect(readFileSync(join(SRC, 'health', 'HealthKitService.ts'), 'utf8')).not.toMatch(/toShare|save\w*Sample/);
  });
});
