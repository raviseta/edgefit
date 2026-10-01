import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { DEFAULT_SETTINGS } from '@/domain/models';
import { fixtures } from '@/health/fixtures';
import { createTestServices, testNow } from '@/test-utils/harness';
import { renderWithServices } from '@/test-utils/render';
import { ActivityScreen } from '../screens/ActivityScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PrivacyScreen } from '../screens/PrivacyScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';

describe('ActivityScreen', () => {
  it('shows 7-day charts, insights and a daily breakdown', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<ActivityScreen now={testNow} />, services);
    expect(await screen.findByTestId('chart-steps')).toBeTruthy();
    expect(screen.getByTestId('chart-score')).toBeTruthy();
    expect(screen.getByTestId('insight-consistent-week')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Yesterday')).toBeTruthy();
    const today = within(screen.getByTestId('day-2026-09-30'));
    expect(today.getByText('6,420 steps · 296 kcal · 34 min')).toBeTruthy();
    expect(today.getByLabelText('Score 92')).toBeTruthy();
  });

  it('stays readable with missing days', async () => {
    const { services } = await createTestServices({ fixture: fixtures.missingMetrics });
    await renderWithServices(<ActivityScreen now={testNow} />, services);
    // Both charts flag their gaps.
    expect(await screen.findAllByText('Dashed gaps mark days with no data.')).toHaveLength(2);
    expect(screen.getAllByText('No data')).toHaveLength(2);
    // A day with only calories is shown, but without a score.
    expect(screen.getByText('— steps · 280 kcal · —')).toBeTruthy();
  });

  it('shows an empty state when the week has no data', async () => {
    const { services } = await createTestServices({ fixture: fixtures.empty });
    await renderWithServices(<ActivityScreen now={testNow} />, services);
    expect(await screen.findByText('No activity in the last 7 days')).toBeTruthy();
    expect(screen.queryByTestId('chart-steps')).toBeNull();
  });

  it('shows the permission-denied state', async () => {
    const { services } = await createTestServices({ settings: { healthDataEnabled: false } });
    await renderWithServices(<ActivityScreen now={testNow} />, services);
    expect(await screen.findByTestId('state-permission-denied')).toBeTruthy();
  });
});

describe('WorkoutsScreen', () => {
  it('lists workouts with type, time, duration and calories', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<WorkoutsScreen now={testNow} />, services);
    expect(await screen.findByText('Running')).toBeTruthy();
    expect(screen.getByText('Today · 7:30 AM')).toBeTruthy();
    expect(screen.getByText('42 min · 365 kcal')).toBeTruthy();
    expect(screen.getByText('Walking')).toBeTruthy();
    expect(screen.getByText('Yesterday · 6:10 PM')).toBeTruthy();
    expect(screen.getByText('31 min · 142 kcal')).toBeTruthy();
    // Cycling has no recorded calories.
    expect(screen.getByText('55 min')).toBeTruthy();
  });

  it('lists several workouts on the same day', async () => {
    const { services } = await createTestServices({ fixture: fixtures.multipleWorkouts });
    await renderWithServices(<WorkoutsScreen now={testNow} />, services);
    expect(await screen.findAllByText(/^Today · /)).toHaveLength(3);
  });

  it('shows an empty state with no workouts', async () => {
    const { services } = await createTestServices({ fixture: fixtures.low });
    await renderWithServices(<WorkoutsScreen now={testNow} />, services);
    expect(await screen.findByText('No workouts yet')).toBeTruthy();
  });
});

describe('PrivacyScreen', () => {
  it('reflects the actual implementation for the demo provider', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<PrivacyScreen />, services);
    expect(await screen.findByText('Cloud processing')).toBeTruthy();
    expect(screen.getByText(/^Not used by EdgeFit/)).toBeTruthy();
    expect(screen.getByText(/^Stored locally on this device/)).toBeTruthy();
    expect(screen.getByText(/simple, transparent rules/)).toBeTruthy();
    expect(screen.getByText(/No real health data is read/)).toBeTruthy();
    expect(screen.getByLabelText('Steps: Demo data')).toBeTruthy();
    expect(screen.getByLabelText('EdgeFit reading Health: On')).toBeTruthy();
  });

  it('asks for confirmation before clearing local data', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { services } = await createTestServices();
    await renderWithServices(<PrivacyScreen />, services);
    await fireEvent.press(await screen.findByTestId('button-clear-data'));
    expect(alert).toHaveBeenCalledWith('Clear local data?', expect.any(String), expect.any(Array));

    // Confirming wipes everything.
    const buttons = alert.mock.calls[0]![2]!;
    await buttons.find((b) => b.style === 'destructive')!.onPress!();
    await waitFor(async () => expect(await services.repositories.settings.get()).toEqual(DEFAULT_SETTINGS));
  });
});

describe('SettingsScreen', () => {
  it('updates the energy unit and insights preference', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<SettingsScreen />, services);
    await fireEvent.press(await screen.findByTestId('segment-kJ'));
    await waitFor(async () => expect((await services.repositories.settings.get()).energyUnit).toBe('kJ'));
    await fireEvent(screen.getByTestId('switch-insights'), 'valueChange', false);
    await waitFor(async () => expect((await services.repositories.settings.get()).analyticsEnabled).toBe(false));
  });

  it('turning health access off stops reading health data', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<SettingsScreen />, services);
    await fireEvent(await screen.findByTestId('switch-health'), 'valueChange', false);
    await waitFor(async () => expect((await services.repositories.settings.get()).healthDataEnabled).toBe(false));
  });
});

describe('OnboardingScreen', () => {
  it('walks through welcome, privacy and permissions, then grants access', async () => {
    const { services } = await createTestServices({ settings: { onboardingCompleted: false, healthDataEnabled: false } });
    await renderWithServices(<OnboardingScreen />, services);
    expect(screen.getByTestId('onboarding-welcome')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('button-next'));
    expect(screen.getByText('Private by design')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('button-next'));
    expect(screen.getByTestId('onboarding-permissions')).toBeTruthy();
    expect(screen.getByText('• Steps')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('button-allow-health'));
    await waitFor(async () =>
      expect(await services.repositories.settings.get()).toMatchObject({
        onboardingCompleted: true,
        healthDataEnabled: true,
        healthPermissionRequested: true,
      }),
    );
  });

  it('lets the user continue without granting access', async () => {
    const { services, health } = await createTestServices({ settings: { onboardingCompleted: false, healthDataEnabled: false } });
    const request = jest.spyOn(health, 'requestAuthorization');
    await renderWithServices(<OnboardingScreen />, services);
    await fireEvent.press(screen.getByTestId('button-next'));
    await fireEvent.press(screen.getByTestId('button-next'));
    await fireEvent.press(screen.getByTestId('button-skip-health'));
    await waitFor(async () =>
      expect(await services.repositories.settings.get()).toMatchObject({ onboardingCompleted: true, healthDataEnabled: false }),
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('records a denied permission as health access off', async () => {
    const { services } = await createTestServices({
      settings: { onboardingCompleted: false, healthDataEnabled: false },
      health: { authorization: 'denied' },
    });
    await renderWithServices(<OnboardingScreen />, services);
    await fireEvent.press(screen.getByTestId('button-next'));
    await fireEvent.press(screen.getByTestId('button-next'));
    await fireEvent.press(screen.getByTestId('button-allow-health'));
    await waitFor(async () =>
      expect(await services.repositories.settings.get()).toMatchObject({ onboardingCompleted: true, healthDataEnabled: false }),
    );
  });
});
