import { Platform } from 'react-native';

import { fixtures, isHealthScenario } from './fixtures';
import type { HealthService } from './HealthService';
import { MockHealthService } from './MockHealthService';

/**
 * Provider selection:
 *  - EXPO_PUBLIC_HEALTH_PROVIDER=mock → MockHealthService (any platform)
 *  - iOS with HealthKit available     → HealthKitService
 *  - anything else (Android, iPad without Health, web) → MockHealthService
 *
 * Whenever the mock is used the UI shows a "Demo data" banner, and the
 * Privacy Center says no real health data is being read.
 * EXPO_PUBLIC_MOCK_SCENARIO picks the fixture (default: normal).
 */
export function createHealthService(): HealthService {
  if (process.env.EXPO_PUBLIC_HEALTH_PROVIDER !== 'mock' && Platform.OS === 'ios') {
    // Required lazily so non-iOS bundles and tests never load the native module.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { HealthKitService } = require('./HealthKitService') as typeof import('./HealthKitService');
    const { isHealthDataAvailable } =
      require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');
    /* eslint-enable @typescript-eslint/no-require-imports */
    try {
      if (isHealthDataAvailable()) {
        return new HealthKitService();
      }
    } catch {
      // Native module missing (e.g. running in Expo Go) – fall through to mock.
    }
  }

  const scenario = process.env.EXPO_PUBLIC_MOCK_SCENARIO;
  return new MockHealthService(fixtures[isHealthScenario(scenario) ? scenario : 'normal']);
}
