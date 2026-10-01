import { fireEvent, render, screen } from '@testing-library/react-native';

import type { DailySummary } from '@/domain/models';
import { InsightCard, MetricCard, ScoreCard } from '../components/ActivityCards';
import { BarChart } from '../components/BarChart';
import { EmptyState, ErrorState } from '../components/StateViews';

const summary: DailySummary = {
  date: '2026-09-30',
  steps: 4000,
  activeCalories: 200,
  activeMinutes: 15,
  workoutCount: 0,
  workoutMinutes: 0,
  activityScore: 35,
};

describe('activity cards', () => {
  it('MetricCard renders value and unit', async () => {
    await render(<MetricCard label="Active Energy" value="420" unit="kcal" />);
    expect(screen.getByLabelText('Active Energy: 420 kcal')).toBeTruthy();
  });

  it('MetricCard renders a dash for missing data', async () => {
    await render(<MetricCard label="Steps" value="—" />);
    expect(screen.getByLabelText('Steps: no data')).toBeTruthy();
  });

  it('ScoreCard explains its calculation on demand', async () => {
    await render(<ScoreCard summary={summary} />);
    expect(screen.getByLabelText('Activity score 35 out of 100')).toBeTruthy();
    expect(screen.queryByTestId('score-breakdown')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'How is this calculated?' }));
    expect(screen.getByTestId('score-breakdown')).toBeTruthy();
    expect(screen.getByText('20 / 40')).toBeTruthy();
    expect(screen.getByText(/not a medical or fitness measurement/)).toBeTruthy();
  });

  it('InsightCard renders title and message', async () => {
    await render(
      <InsightCard
        insight={{ id: 'x', type: 'on-track', title: 'On track', message: 'Nice.', generatedAt: '2026-09-30T00:00:00Z' }}
      />,
    );
    expect(screen.getByText('On track')).toBeTruthy();
    expect(screen.getByText('Nice.')).toBeTruthy();
  });
});

describe('BarChart', () => {
  it('describes missing days as "no data" and notes the gaps', async () => {
    await render(
      <BarChart
        title="Steps"
        testID="chart"
        formatValue={(v) => String(v)}
        data={[
          { key: 'a', label: 'Mon', value: 100 },
          { key: 'b', label: 'Tue', value: null },
        ]}
      />,
    );
    expect(screen.getByLabelText('Steps. Mon: 100, Tue: no data')).toBeTruthy();
    expect(screen.getByText('Dashed gaps mark days with no data.')).toBeTruthy();
  });
});

describe('state views', () => {
  it('EmptyState renders an optional action', async () => {
    const onAction = jest.fn();
    await render(<EmptyState title="Nothing" message="Here" actionTitle="Do it" onAction={onAction} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Do it' }));
    expect(onAction).toHaveBeenCalled();
  });

  it('ErrorState offers a retry', async () => {
    const onRetry = jest.fn();
    await render(<ErrorState onRetry={onRetry} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
