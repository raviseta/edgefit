import { fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fixtures } from '@/health/fixtures';
import { createTestServices, testNow } from '@/test-utils/harness';
import { renderWithServices } from '@/test-utils/render';
import { ActivityScreen } from '../screens/ActivityScreen';
import { CalendarScreen } from '../screens/CalendarScreen';

const label = (text: string) => screen.getByLabelText(text);
const flatStyle = (el: { props: { style?: unknown } }) =>
  Object.assign({}, ...[el.props.style].flat(3).filter(Boolean)) as Record<string, unknown>;

describe('CalendarScreen', () => {
  it('shows a summary, 30 days in a Monday-first grid, a legend and today selected', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<CalendarScreen now={testNow} />, services);

    expect(await screen.findByTestId('calendar-grid')).toBeTruthy();
    expect(screen.getAllByTestId(/^calendar-day-/)).toHaveLength(30);
    expect(screen.getByTestId('calendar-legend')).toBeTruthy();
    expect(screen.getByText('Sep 1 – Sep 30')).toBeTruthy();
    // Window starts Tue 1 Sep: the first cell carries the month label.
    expect(within(screen.getByTestId('calendar-day-2026-09-01')).getByText('Sep')).toBeTruthy();

    // A sync stores today plus 7 baseline days, so 8 of 30 days have a score.
    expect(label('Days with a score: 8 of 30')).toBeTruthy();
    expect(screen.getByText('8 of 30 days scored')).toBeTruthy();
    expect(label('Current streak: 8 days')).toBeTruthy();
    expect(label('Best day: Yesterday, score 100')).toBeTruthy();
    expect(screen.getByText(/average Activity Score/)).toBeTruthy();
    expect(screen.getByTestId('calendar-sparse-note')).toBeTruthy();

    // Today is marked and selected by default, and flagged as in progress.
    const today = screen.getByTestId('calendar-day-2026-09-30');
    expect(today.props.accessibilityState).toEqual({ selected: true });
    expect(today.props.accessibilityLabel).toBe(
      'Wednesday, September 30, today, still in progress, Activity Score 92, 1 workout',
    );
    expect(screen.getAllByTestId('calendar-today-marker')).toHaveLength(1);
    expect(screen.getAllByTestId('calendar-selected-ring')).toHaveLength(1);
    const details = within(screen.getByTestId('calendar-details-2026-09-30'));
    expect(details.getByText('Today · totals may still grow')).toBeTruthy();
    expect(details.getByText('In progress')).toBeTruthy();
  });

  it('the average uses scored days only', async () => {
    const { services } = await createTestServices();
    await services.activity.refresh();
    const { summary } = await services.activity.getCalendar();
    await renderWithServices(<CalendarScreen now={testNow} />, services);
    expect(
      await screen.findByLabelText(
        `Average Activity Score: ${Math.round(summary.averageScore!)}, from scored days only`,
      ),
    ).toBeTruthy();
  });

  it('selected day shows score, metrics, breakdown and workouts that match the stored data', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<CalendarScreen now={testNow} />, services);
    await screen.findByTestId('calendar-details-2026-09-30');

    expect(label('Activity Score: 92 out of 100, Great day')).toBeTruthy();
    expect(label('Steps: 6,420')).toBeTruthy();
    expect(label('Active energy: 296 kcal')).toBeTruthy();
    expect(label('Exercise: 34 min')).toBeTruthy();
    expect(label('Workout: 1, 42 min')).toBeTruthy();
    expect(label('Steps (target 8,000): 32.1 of 40')).toBeTruthy();
    expect(label('Active minutes (target 30): 30 of 30')).toBeTruthy();
    expect(label('Workout minutes (target 30): 30 of 30')).toBeTruthy();
    expect(within(screen.getByTestId('calendar-workouts')).getByText('Running')).toBeTruthy();
  });

  it('selecting a past day moves the ring and shows final totals', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<CalendarScreen now={testNow} />, services);
    await fireEvent.press(await screen.findByTestId('calendar-day-2026-09-29'));

    expect(screen.getByTestId('calendar-day-2026-09-29').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('calendar-day-2026-09-30').props.accessibilityState).toEqual({ selected: false });
    const details = within(screen.getByTestId('calendar-details-2026-09-29'));
    expect(details.getByText('Tuesday, September 29')).toBeTruthy();
    expect(details.getByText('Final totals')).toBeTruthy();
    expect(details.queryByText('In progress')).toBeNull();
  });

  it('a day with partial metrics and no workouts keeps missing values unknown', async () => {
    const { services } = await createTestServices({ fixture: fixtures.missingMetrics });
    await renderWithServices(<CalendarScreen now={testNow} />, services);
    await fireEvent.press(await screen.findByTestId('calendar-day-2026-09-27'));

    const details = within(screen.getByTestId('calendar-details-2026-09-27'));
    expect(details.getByText('Sunday, September 27')).toBeTruthy();
    expect(details.getByText('Partial data · not enough for a score')).toBeTruthy();
    expect(label('Activity Score: not available')).toBeTruthy();
    expect(label('Steps: no data')).toBeTruthy();
    expect(label('Active energy: 280 kcal')).toBeTruthy();
    expect(label('Exercise: no data')).toBeTruthy();
    expect(label('Workouts: 0')).toBeTruthy();
    expect(screen.queryByTestId('calendar-score-breakdown')).toBeNull();
    expect(screen.queryByTestId('calendar-workouts')).toBeNull();
  });

  it('a day with nothing stored shows the no-data state instead of zeros', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<CalendarScreen now={testNow} />, services);
    await fireEvent.press(await screen.findByTestId('calendar-day-2026-09-10'));

    const details = within(screen.getByTestId('calendar-details-2026-09-10'));
    expect(details.getByText('No Health data recorded')).toBeTruthy();
    expect(details.getByText('No data for this day')).toBeTruthy();
    expect(screen.queryByLabelText(/^Steps:/)).toBeNull();
    expect(screen.queryByTestId('calendar-score-breakdown')).toBeNull();
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
    // Visually distinct too: dashed outline for unknown, solid filled tile for zero.
    expect(flatStyle(unknown)).toMatchObject({ borderStyle: 'dashed', backgroundColor: 'transparent' });
    expect(flatStyle(zero)).toMatchObject({ borderStyle: 'solid' });
    expect(flatStyle(zero).backgroundColor).not.toBe('transparent');

    // The zero day counts toward coverage (9 of 30); unknown days do not.
    expect(label('Days with a score: 9 of 30')).toBeTruthy();
  });

  it('shows an empty-history state without fabricated stats', async () => {
    const { services } = await createTestServices({ fixture: fixtures.empty });
    await renderWithServices(<CalendarScreen now={testNow} />, services);
    expect(await screen.findByText('No activity history yet')).toBeTruthy();
    expect(screen.queryByTestId('calendar-stats')).toBeNull();
    expect(screen.queryByTestId('calendar-sparse-note')).toBeNull();
    expect(screen.getAllByTestId(/^calendar-day-/)).toHaveLength(30);
    expect(screen.getByText('Nothing from Health yet today')).toBeTruthy();
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
