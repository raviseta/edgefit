import { fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fixtures } from '@/health/fixtures';
import { createTestServices, testNow } from '@/test-utils/harness';
import { renderWithServices } from '@/test-utils/render';
import { ActivityScreen } from '../screens/ActivityScreen';
import { CalendarScreen } from '../screens/CalendarScreen';

const detailRow = (label: string, value: string) => screen.getByLabelText(`${label}: ${value}`);

describe('CalendarScreen', () => {
  it('shows 30 days, a legend, honest summary stats and today selected', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<CalendarScreen now={testNow} />, services);

    expect(await screen.findByTestId('calendar-grid')).toBeTruthy();
    expect(screen.getAllByTestId(/^calendar-day-/)).toHaveLength(30);
    expect(screen.getByTestId('calendar-day-2026-09-01')).toBeTruthy();
    expect(screen.getByTestId('calendar-legend')).toBeTruthy();
    expect(screen.getByText('Sep 1 – Sep 30, 2026')).toBeTruthy();

    // A sync stores today plus 7 baseline days, so 8 of 30 days have a score.
    expect(screen.getByLabelText('Days with a score: 8 of 30')).toBeTruthy();
    expect(screen.getByText(/left out rather than counted as zero/)).toBeTruthy();
    expect(screen.getByLabelText('Best day · Yesterday: 100')).toBeTruthy();

    // Today is marked and selected by default, and flagged as in progress.
    const today = screen.getByTestId('calendar-day-2026-09-30');
    expect(today.props.accessibilityState).toEqual({ selected: true });
    expect(today.props.accessibilityLabel).toBe(
      'Wednesday, September 30, today, still in progress, Activity Score 92, 1 workout',
    );
    expect(screen.getAllByTestId('calendar-today-marker')).toHaveLength(1);
    const details = within(screen.getByTestId('calendar-details-2026-09-30'));
    expect(details.getByText('Today · still in progress, totals may grow')).toBeTruthy();
  });

  it('selected day shows metrics, score breakdown and workouts that match the stored data', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<CalendarScreen now={testNow} />, services);
    await screen.findByTestId('calendar-details-2026-09-30');

    expect(screen.getByLabelText('Activity Score: 92 out of 100')).toBeTruthy();
    expect(detailRow('Steps', '6,420')).toBeTruthy();
    expect(detailRow('Active energy', '296 kcal')).toBeTruthy();
    expect(detailRow('Exercise minutes', '34 min')).toBeTruthy();
    const breakdown = within(screen.getByTestId('calendar-score-breakdown'));
    expect(breakdown.getByText('32.1 / 40')).toBeTruthy();
    expect(breakdown.getAllByText('30 / 30')).toHaveLength(2);
    expect(screen.getByTestId('workout-wk-normal-1')).toBeTruthy();
    expect(screen.getByText('Running')).toBeTruthy();
  });

  it('selecting a day with partial metrics and no workouts keeps missing values unknown', async () => {
    const { services } = await createTestServices({ fixture: fixtures.missingMetrics });
    await renderWithServices(<CalendarScreen now={testNow} />, services);
    await fireEvent.press(await screen.findByTestId('calendar-day-2026-09-27'));

    expect(screen.getByTestId('calendar-day-2026-09-27').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('calendar-day-2026-09-30').props.accessibilityState).toEqual({ selected: false });
    const details = within(screen.getByTestId('calendar-details-2026-09-27'));
    expect(details.getByText('Sunday, September 27')).toBeTruthy();
    expect(detailRow('Steps', 'no data')).toBeTruthy();
    expect(detailRow('Active energy', '280 kcal')).toBeTruthy();
    expect(detailRow('Exercise minutes', 'no data')).toBeTruthy();
    expect(screen.getByLabelText('Activity Score: not available')).toBeTruthy();
    expect(screen.queryByTestId('calendar-score-breakdown')).toBeNull();
    expect(screen.getByTestId('calendar-no-workouts')).toBeTruthy();
  });

  it('distinguishes a valid zero score from an unknown score', async () => {
    const { services } = await createTestServices();
    await services.activity.refresh();
    await services.repositories.summaries.upsertMany([
      { date: '2026-09-15', steps: 0, activeCalories: 0, activeMinutes: 0, workoutCount: 0, workoutMinutes: 0, activityScore: 0 },
    ]);
    await renderWithServices(<CalendarScreen now={testNow} />, services);

    const zero = await screen.findByTestId('calendar-day-2026-09-15');
    const unknown = screen.getByTestId('calendar-day-2026-09-14');
    expect(zero.props.accessibilityLabel).toBe('Tuesday, September 15, Activity Score 0');
    expect(unknown.props.accessibilityLabel).toBe('Monday, September 14, no score, data unavailable');
    expect(within(zero).getByText('0')).toBeTruthy();
    expect(within(unknown).getByText('—')).toBeTruthy();
    // Visually distinct too: dashed outline for unknown, solid neutral tile for zero.
    const style = (el: typeof zero) => Object.assign({}, ...[el.props.style].flat(3).filter(Boolean));
    expect(style(unknown)).toMatchObject({ borderStyle: 'dashed', backgroundColor: 'transparent' });
    expect(style(zero)).toMatchObject({ borderStyle: 'solid' });
    expect(style(zero).backgroundColor).not.toBe('transparent');

    // The zero day counts toward coverage (9 of 30) and is in the average; unknown days are not.
    expect(screen.getByLabelText('Days with a score: 9 of 30')).toBeTruthy();
  });

  it('shows an empty-history state without fabricated stats', async () => {
    const { services } = await createTestServices({ fixture: fixtures.empty });
    await renderWithServices(<CalendarScreen now={testNow} />, services);
    expect(await screen.findByText('No activity history yet')).toBeTruthy();
    expect(screen.queryByTestId('calendar-stats')).toBeNull();
    expect(screen.getAllByTestId(/^calendar-day-/)).toHaveLength(30);
    expect(screen.getByLabelText('Activity Score: not available')).toBeTruthy();
    expect(detailRow('Steps', 'no data')).toBeTruthy();
  });

  it('shows the permission-denied state when health reading is off', async () => {
    const { services } = await createTestServices({ settings: { healthDataEnabled: false } });
    await renderWithServices(<CalendarScreen now={testNow} />, services);
    expect(await screen.findByTestId('state-permission-denied')).toBeTruthy();
    expect(screen.queryByTestId('calendar-grid')).toBeNull();
  });

  it('labels demo data and syncs only through the shared snapshot', async () => {
    const { services, health } = await createTestServices();
    const steps = jest.spyOn(health, 'getSteps');
    await renderWithServices(<CalendarScreen now={testNow} />, services);
    expect(await screen.findByTestId('calendar-grid')).toBeTruthy();
    expect(screen.getByTestId('banner-demo-data')).toBeTruthy();
    expect(steps).toHaveBeenCalledTimes(1);
  });
});

describe('ActivityScreen calendar entry point', () => {
  it('opens the 30-day calendar', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<ActivityScreen now={testNow} />, services);
    await fireEvent.press(await screen.findByTestId('row-calendar'));
    expect(router.push).toHaveBeenCalledWith('/activity/calendar');
  });
});
