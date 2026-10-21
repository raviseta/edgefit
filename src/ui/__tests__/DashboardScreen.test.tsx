import { fireEvent, screen, within } from '@testing-library/react-native';

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

    expect(screen.getByText('Good evening')).toBeTruthy();
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

  it('keeps showing the last saved value when one metric fails, and says so', async () => {
    const { services, health } = await createTestServices();
    await services.activity.refresh();
    jest.spyOn(health, 'getActiveCalories').mockRejectedValue(new Error('down'));
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    expect(await screen.findByTestId('banner-partial-sync')).toBeTruthy();
    expect(
      screen.getByLabelText(
        "Some data couldn't be read (active energy). Showing the last values saved on this device for those; everything else is up to date.",
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('Active Energy: 296 kcal')).toBeTruthy();
  });

  it('respects the energy unit preference', async () => {
    const { services } = await createTestServices({ settings: { energyUnit: 'kJ' } });
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    expect(await screen.findByLabelText('Active Energy: 1,238 kJ')).toBeTruthy();
  });
});

describe('DashboardScreen – Personal Activity Insights', () => {
  it('shows the three insights with their periods and supporting values', async () => {
    const { services } = await createTestServices({ fixture: fixtures.twoWeeks });
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    expect(await screen.findByText('Personal Activity Insights')).toBeTruthy();

    const active = within(screen.getByTestId('personal-insight-activity-consistency'));
    expect(active.getByText('You recorded activity on 7 of the last 7 days.')).toBeTruthy();
    expect(active.getByText('Sep 23 – Sep 29')).toBeTruthy();

    const steps = within(screen.getByTestId('personal-insight-weekly-steps'));
    expect(steps.getByText('Your recorded steps increased compared with the previous week.')).toBeTruthy();
    expect(steps.getByText('Sep 23 – Sep 29 vs Sep 16 – Sep 22')).toBeTruthy();
    expect(steps.getByText('Last 7 days: 9,000 steps a day on average (7 of 7 days with steps).')).toBeTruthy();
    expect(steps.getByText('Change: +13%.')).toBeTruthy();

    const workouts = within(screen.getByTestId('personal-insight-exercise-frequency'));
    expect(workouts.getByText('You recorded workouts on 3 different days in the last 7 days.')).toBeTruthy();
  });

  it('explains a calculation on demand', async () => {
    const { services } = await createTestServices({ fixture: fixtures.twoWeeks });
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    const card = within(await screen.findByTestId('personal-insight-weekly-steps'));
    expect(screen.queryByTestId('personal-insight-weekly-steps-explanation')).toBeNull();
    await fireEvent.press(card.getByRole('button', { name: 'How is this calculated?' }));
    expect(screen.getByTestId('personal-insight-weekly-steps-explanation')).toBeTruthy();
  });

  it('says why the step comparison is missing, with valid-day counts, instead of inventing one', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    const note = await screen.findByTestId('personal-insight-unavailable-weekly-steps');
    expect(
      within(note).getByText(
        'A weekly step comparison needs at least 5 days with recorded steps in each week (last 7 days: 7, week before: 0).',
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId('personal-insight-weekly-steps')).toBeNull();
    expect(screen.getByTestId('personal-insight-activity-consistency')).toBeTruthy();
  });

  it('shows coverage when some days have no data', async () => {
    const { services } = await createTestServices({ fixture: fixtures.missingMetrics });
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    const active = within(await screen.findByTestId('personal-insight-activity-consistency'));
    expect(active.getByText('You recorded activity on all 5 days with data in the last 7 days.')).toBeTruthy();
  });

  it('shows an honest empty state with no history', async () => {
    const { services } = await createTestServices({ fixture: fixtures.empty });
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    expect(await screen.findByTestId('personal-insights-empty')).toBeTruthy();
    expect(screen.queryByTestId('personal-insight-activity-consistency')).toBeNull();
    expect(screen.queryByTestId('personal-insight-weekly-steps')).toBeNull();
    expect(screen.queryByTestId('personal-insight-exercise-frequency')).toBeNull();
  });

  it('keeps showing insights from saved data when the sync fails, alongside the warning', async () => {
    const { services, health } = await createTestServices({ fixture: fixtures.twoWeeks });
    await services.activity.refresh();
    jest.spyOn(health, 'isAvailable').mockRejectedValue(new Error('down'));
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    expect(await screen.findByTestId('banner-sync-failed')).toBeTruthy();
    expect(screen.getByTestId('personal-insight-weekly-steps')).toBeTruthy();
  });

  it('is hidden when insights are turned off', async () => {
    const { services } = await createTestServices({ fixture: fixtures.twoWeeks, settings: { analyticsEnabled: false } });
    await renderWithServices(<DashboardScreen now={testNow} />, services);
    expect(await screen.findByTestId('dashboard')).toBeTruthy();
    expect(screen.queryByTestId('personal-insights')).toBeNull();
  });
});
