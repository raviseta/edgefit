import type { HealthService } from '../HealthService';

/**
 * Provider selection, including the fallback when HealthKit's native module
 * can't be loaded at all (Expo Go, or a binary without react-native-nitro-modules).
 * Each case loads the modules fresh so it can swap in its own native-module fake.
 */
const ORIGINAL_PROVIDER = process.env.EXPO_PUBLIC_HEALTH_PROVIDER;

afterEach(() => {
  if (ORIGINAL_PROVIDER === undefined) delete process.env.EXPO_PUBLIC_HEALTH_PROVIDER;
  else process.env.EXPO_PUBLIC_HEALTH_PROVIDER = ORIGINAL_PROVIDER;
  jest.resetModules();
});

function loadWith(healthkitFactory: () => unknown, os: 'ios' | 'android' = 'ios'): HealthService {
  let service!: HealthService;
  jest.isolateModules(() => {
    jest.doMock('@kingstinct/react-native-healthkit', healthkitFactory);
    // Fresh module instances per case, so each sees its own native-module fake.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { Platform } = require('react-native') as typeof import('react-native');
    Platform.OS = os;
    const { createHealthService } = require('../createHealthService') as typeof import('../createHealthService');
    /* eslint-enable @typescript-eslint/no-require-imports */
    service = createHealthService();
  });
  return service;
}

const healthkitAvailable = (available: boolean) => () => ({
  isHealthDataAvailable: () => available,
  WorkoutActivityType: {},
  AuthorizationRequestStatus: {},
});

describe('createHealthService', () => {
  it('falls back to demo data when the HealthKit native module cannot be loaded', () => {
    delete process.env.EXPO_PUBLIC_HEALTH_PROVIDER;
    const service = loadWith(() => {
      throw new Error('Failed to get NitroModules: The native "NitroModules" Turbo/Native-Module could not be found.');
    });
    expect(service.provider).toBe('mock');
  });

  it('falls back to demo data when the native call itself throws', () => {
    delete process.env.EXPO_PUBLIC_HEALTH_PROVIDER;
    const service = loadWith(() => ({
      isHealthDataAvailable: () => {
        throw new Error('native module missing');
      },
      WorkoutActivityType: {},
      AuthorizationRequestStatus: {},
    }));
    expect(service.provider).toBe('mock');
  });

  it('uses HealthKit on iOS when it is available', () => {
    delete process.env.EXPO_PUBLIC_HEALTH_PROVIDER;
    expect(loadWith(healthkitAvailable(true)).provider).toBe('healthkit');
  });

  it('uses demo data on iOS when HealthKit is unavailable on the device', () => {
    delete process.env.EXPO_PUBLIC_HEALTH_PROVIDER;
    expect(loadWith(healthkitAvailable(false)).provider).toBe('mock');
  });

  it('uses demo data when EXPO_PUBLIC_HEALTH_PROVIDER=mock, without loading the native module', () => {
    process.env.EXPO_PUBLIC_HEALTH_PROVIDER = 'mock';
    const factory = jest.fn(healthkitAvailable(true));
    expect(loadWith(factory).provider).toBe('mock');
    expect(factory).not.toHaveBeenCalled();
  });

  it('never loads the native module off iOS', () => {
    delete process.env.EXPO_PUBLIC_HEALTH_PROVIDER;
    const factory = jest.fn(healthkitAvailable(true));
    expect(loadWith(factory, 'android').provider).toBe('mock');
    expect(factory).not.toHaveBeenCalled();
  });
});
