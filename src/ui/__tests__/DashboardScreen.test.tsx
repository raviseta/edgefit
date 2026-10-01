import { screen } from '@testing-library/react-native';

import { fixtures } from '@/health/fixtures';
import { createTestServices, testNow } from '@/test-utils/harness';
import { renderWithServices } from '@/test-utils/render';
import { DashboardScreen } from '../screens/DashboardScreen';

describe('DashboardScreen', () => {
  it('shows a loading state first, then today\'s activity', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    // First paint happens before the async snapshot resolves.
    expect(await screen.findByTestId('dashboard')).toBeTruthy();

    expect(screen.getByText('Good evening 👋')).toBeTruthy();
    expect(screen.getByLabelText('Steps: 6,420')).toBeTruthy();
    expect(screen.getByLabelText('Active Energy: 296 kcal')).toBeTruthy();
    expect(screen.getByLabelText('Active Time: 34 min')).toBeTruthy();
    expect(screen.getByLabelText('Workouts: 1')).toBeTruthy();
    expect(screen.getByLabelText('Activity score 92 out of 100')).toBeTruthy();
    expect(screen.getByTestId('insight-below-average')).toBeTruthy();
  });

  it('renders the loading state while data is pending', async () => {
    const { services } = await createTestServices();
    jest.spyOn(services.activity, 'refresh').mockReturnValue(new Promise(() => {}));
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    expect(screen.getByTestId('state-loading')).toBeTruthy();
  });

  it('labels mock data as demo data', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    expect(await screen.findByTestId('banner-demo-data')).toBeTruthy();
  });

  it('shows an empty state instead of zeros when there is no data', async () => {
    const { services } = await createTestServices({ fixture: fixtures.empty });
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    expect(await screen.findByText('No activity data for today yet')).toBeTruthy();
    expect(screen.queryByTestId('metric-steps')).toBeNull();
    expect(screen.queryByTestId('score-card')).toBeNull();
  });

  it('shows missing metrics as "no data", not zero', async () => {
    const { services } = await createTestServices({ fixture: fixtures.missingMetrics });
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    expect(await screen.findByLabelText('Steps: 3,400')).toBeTruthy();
    expect(screen.getByLabelText('Active Energy: no data')).toBeTruthy();
    expect(screen.getByLabelText('Active Time: no data')).toBeTruthy();
  });

  it('shows the permission-denied state when health access is off', async () => {
    const { services } = await createTestServices({ settings: { healthDataEnabled: false } });
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    expect(await screen.findByText('Health data access is currently unavailable.')).toBeTruthy();
    expect(screen.getByText('You can enable access later from Settings.')).toBeTruthy();
  });

  it('shows a recoverable error state when local storage fails', async () => {
    const { services, db } = await createTestServices();
    db.failing = true;
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    expect(await screen.findByTestId('state-error')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('warns and shows cached data when the health sync fails', async () => {
    const { services, health } = await createTestServices();
    await services.activity.refresh();
    jest.spyOn(health, 'isAvailable').mockRejectedValue(new Error('down'));
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    expect(await screen.findByTestId('banner-sync-failed')).toBeTruthy();
    expect(screen.getByLabelText('Steps: 6,420')).toBeTruthy();
  });

  it('respects the energy unit preference', async () => {
    const { services } = await createTestServices({ settings: { energyUnit: 'kJ' } });
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    expect(await screen.findByLabelText('Active Energy: 1,238 kJ')).toBeTruthy();
  });
});
