// Global test setup. Tests never touch live HealthKit: the native module is
// replaced with an inert stub so accidental imports fail loudly instead of crashing.
jest.mock('@kingstinct/react-native-healthkit', () => ({
  isHealthDataAvailable: () => false,
  requestAuthorization: jest.fn(() => Promise.reject(new Error('HealthKit is not available in tests'))),
}));

// Screens navigate imperatively; route files themselves are not under test.
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
