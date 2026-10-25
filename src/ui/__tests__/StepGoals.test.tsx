import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { fixtures } from '@/health/fixtures';
import { createTestServices, testNow } from '@/test-utils/harness';
import { renderWithServices } from '@/test-utils/render';
import { DashboardScreen } from '../screens/DashboardScreen';

it('shows coverage and accessible actions; saves a manual target', async () => {
  const { services } = await createTestServices();
  await renderWithServices(<DashboardScreen now={testNow} />, services);
  const card = within(await screen.findByTestId('step-goals'));
  expect(card.getByText('No daily goal set')).toBeTruthy();
  expect(card.getByText('Suggestions need 10 valid days out of 14; 7 are available.')).toBeTruthy();
  await fireEvent.press(card.getByRole('button', { name: 'Set manually' }));
  await fireEvent.changeText(card.getByLabelText('Daily step target'), '5000');
  await fireEvent.press(card.getByRole('button', { name: 'Save goal' }));
  await waitFor(() => expect(card.getByText('5,000 steps a day')).toBeTruthy());
  expect(card.getByRole('progressbar').props.accessibilityValue.text).toBe('128%');
  expect(card.getByText('Your manual goal stays in place. Adaptive suggestions are paused.')).toBeTruthy();
});
it('shows a suggestion and dismisses it without choosing a goal', async () => {
  const { services } = await createTestServices({ fixture: fixtures.twoWeeks });
  await renderWithServices(<DashboardScreen now={testNow} />, services);
  const card = within(await screen.findByTestId('step-goals'));
  expect(card.getByText(/Suggested daily goal:/)).toBeTruthy();
  await fireEvent.press(card.getByRole('button', { name: 'Not now' }));
  await waitFor(() => expect(card.queryByText(/Suggested daily goal:/)).toBeNull());
  expect(card.getByText('No daily goal set')).toBeTruthy();
});
it('does not represent missing steps as zero progress', async () => {
  const { services } = await createTestServices({ fixture: fixtures.empty });
  await services.activity.updateStepGoal({ kind: 'manual', steps: 5000 }, 0);
  await renderWithServices(<DashboardScreen now={testNow} />, services);
  const card = within(await screen.findByTestId('step-goals'));
  expect(card.getByText("Today's steps unavailable.")).toBeTruthy();
  expect(card.queryByRole('progressbar')).toBeNull();
});
