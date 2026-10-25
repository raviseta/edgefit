import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { ActivitySnapshot } from '@/services/ActivityService';
import { useServices } from '@/services/ServicesProvider';
import { isValidStepGoal } from '@/domain/stepGoals';
import { formatMetric } from '@/lib/format';
import { queryKeys } from '../hooks';
import { spacing, typography, useTheme } from '../theme';
import { Button, Card, SectionTitle } from './primitives';

export function StepGoals({ snapshot, refreshing = false }: { snapshot: ActivitySnapshot; refreshing?: boolean }) {
  const { activity } = useServices();
  const client = useQueryClient();
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [entry, setEntry] = useState('');
  const [expanded, setExpanded] = useState(false);
  const { preferences, suggestion, generation } = snapshot.stepGoals;
  const goal = preferences.goal;
  const mutation = useMutation({
    mutationFn: (action: Parameters<typeof activity.updateStepGoal>[0]) => activity.updateStepGoal(action, generation),
    onSuccess: async (data) => {
      setEditing(false);
      if (activity.goalGeneration !== generation) return;
      client.setQueryData(queryKeys.snapshot, data);
      await client.invalidateQueries({ queryKey: queryKeys.calendar });
    },
    onError: () => client.invalidateQueries({ queryKey: queryKeys.snapshot }),
  });
  const fresh = !refreshing && snapshot.sync.status === 'synced' && !snapshot.sync.failedMetrics.includes('steps');
  const steps = snapshot.today?.steps ?? null;
  const progress = goal && steps !== null && fresh ? Math.round(steps / goal.activeSteps * 100) : null;
  const disabled = mutation.isPending || refreshing;
  const note = suggestion.status === 'suggested' ? null : {
    coverage: `Suggestions need 10 valid days out of 14; ${suggestion.validDays} are available.`,
    zero_baseline: 'No suggestion from this history yet.',
    current_above_baseline: 'Your current goal is above your recent median. You can review it manually whenever you like.',
    small_change: 'No meaningful adjustment suggested.',
    manual: 'Your manual goal stays in place. Adaptive suggestions are paused.',
    dismissed: 'Suggestion paused. Your current goal stays in place.',
    unavailable: 'Suggestions are paused while steps cannot be refreshed or insights are off.',
  }[suggestion.reason];
  return (
    <View testID="step-goals" style={{ gap: spacing.md }}>
      <SectionTitle>Daily step goal</SectionTitle>
      <Card style={{ gap: spacing.md }}>
        <Text style={[typography.headline, { color: colors.text }]}>
          {goal ? `${formatMetric(goal.activeSteps)} steps a day` : 'No daily goal set'}
        </Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>
          {steps === null ? "Today's steps unavailable." : `${formatMetric(steps)} steps ${fresh ? 'recorded today — day in progress.' : 'last saved for today — refresh unavailable.'}`}
        </Text>
        {progress !== null ? (
          <View accessible accessibilityRole="progressbar" accessibilityLabel="Daily step goal progress, day in progress"
            accessibilityValue={{ min: 0, max: 100, now: Math.min(100, progress), text: `${progress}%` }}>
            <Text style={[typography.body, { color: colors.text }]}>{progress}% of your goal so far</Text>
            <View style={{ height: 8, backgroundColor: colors.surfaceMuted, borderRadius: 4 }}>
              <View style={{ height: 8, width: `${Math.min(100, progress)}%`, backgroundColor: colors.accent, borderRadius: 4 }} />
            </View>
          </View>
        ) : null}
        {suggestion.status === 'suggested' ? (
          <>
            <Text style={[typography.headline, { color: colors.text }]}>Suggested daily goal: {formatMetric(suggestion.suggestedSteps)} steps</Text>
            <Text style={[typography.body, { color: colors.textMuted }]}>
              Based on {suggestion.validDays} valid days in the past 14 complete days. Your recent median was {formatMetric(suggestion.baselineSteps)} steps. This suggestion is a modest adjustment.
            </Text>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
              onPress={() => setExpanded((value) => !value)} style={{ minHeight: 48, justifyContent: 'center' }}>
              <Text style={[typography.caption, { color: colors.accent, textDecorationLine: 'underline' }]}>
                {expanded ? 'Hide goal calculation' : 'How is this goal calculated?'}
              </Text>
            </Pressable>
            {expanded ? <Text style={[typography.caption, { color: colors.textMuted }]}>
              {suggestion.periodStartLocal} to {suggestion.periodEndLocal}: {suggestion.validDays} of 14 days with complete step data.
              {' '}The median is the middle recorded value. We add 5% and round to 250 steps; any increase is capped at 10% of your current goal. Missing days are left out and today is excluded.
            </Text> : null}
            <Button title="Use this goal" disabled={disabled} onPress={() => mutation.mutate({ kind: 'accept', token: suggestion.token })} />
            <Button title="Not now" variant="secondary" disabled={disabled} onPress={() => mutation.mutate({ kind: 'dismiss', token: suggestion.token })} />
          </>
        ) : <Text style={[typography.body, { color: colors.textMuted }]}>{note}</Text>}
        <Button title="Set manually" variant="secondary" disabled={disabled} onPress={() => { setEntry(goal ? String(goal.activeSteps) : ''); setEditing(true); mutation.reset(); }} />
        {editing ? (
          <>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Choose a whole number from 1 to 100,000 steps.</Text>
            <TextInput accessibilityLabel="Daily step target" keyboardType="number-pad" value={entry} onChangeText={setEntry}
              editable={!disabled} style={[typography.body, { minHeight: 48, borderWidth: 1, borderColor: colors.textMuted, color: colors.text, padding: spacing.md, borderRadius: 8 }]} />
            <Button title="Save goal" disabled={disabled || !/^\d+$/.test(entry) || !isValidStepGoal(Number(entry))} onPress={() => mutation.mutate({ kind: 'manual', steps: Number(entry) })} />
            <Button title="Cancel" variant="secondary" disabled={disabled} onPress={() => setEditing(false)} />
          </>
        ) : null}
        {mutation.isError ? <Text accessibilityRole="alert" style={[typography.body, { color: colors.danger }]}>{mutation.error.message}</Text> : null}
        <Text style={[typography.caption, { color: colors.textMuted }]}>A planning aid based on local rules, not medical advice. Your goal changes only when you choose.</Text>
      </Card>
    </View>
  );
}
