import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { calculateActivityScore, SCORE_TARGETS, SCORE_WEIGHTS } from '@/domain/activityScore';
import type { ActivityInsight, DailySummary } from '@/domain/models';
import { EMPTY_VALUE } from '@/lib/format';
import { radius, spacing, typography, useTheme } from '../theme';
import { Card } from './primitives';

export function MetricCard({ label, value, unit, testID }: { label: string; value: string; unit?: string; testID?: string }) {
  const { colors } = useTheme();
  const missing = value === EMPTY_VALUE;
  return (
    <Card
      testID={testID}
      style={styles.metricCard}
    >
      <View accessible accessibilityLabel={`${label}: ${missing ? 'no data' : `${value}${unit ? ` ${unit}` : ''}`}`}>
        <Text style={[typography.metric, { color: missing ? colors.textMuted : colors.text }]}>
          {value}
          {unit && !missing ? <Text style={[typography.body, { color: colors.textMuted }]}> {unit}</Text> : null}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      </View>
    </Card>
  );
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

export function ScoreCard({ summary }: { summary: DailySummary }) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const score = calculateActivityScore({
    steps: summary.steps,
    activeMinutes: summary.activeMinutes,
    workoutMinutes: summary.workoutMinutes,
  });

  return (
    <Card testID="score-card">
      <Text style={[typography.overline, { color: colors.textMuted }]}>Activity Score</Text>
      <View
        accessible
        accessibilityLabel={score ? `Activity score ${score.total} out of 100` : 'Activity score unavailable'}
        style={styles.scoreRow}
      >
        <Text style={[typography.largeNumber, { color: colors.text }]}>{score ? score.total : EMPTY_VALUE}</Text>
        <Text style={[typography.headline, { color: colors.textMuted }]}> / 100</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        <View style={[styles.fill, { width: `${score?.total ?? 0}%`, backgroundColor: colors.accent }]} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((e) => !e)}
        hitSlop={8}
        style={styles.disclosure}
      >
        <Text style={[typography.caption, { color: colors.accent }]}>
          {expanded ? 'Hide calculation' : 'How is this calculated?'}
        </Text>
      </Pressable>
      {expanded && score ? (
        <View testID="score-breakdown" style={styles.breakdown}>
          <BreakdownRow label={`Steps (target ${SCORE_TARGETS.steps.toLocaleString('en-US')})`} value={score.breakdown.steps} max={SCORE_WEIGHTS.steps} />
          <BreakdownRow label={`Active minutes (target ${SCORE_TARGETS.activeMinutes})`} value={score.breakdown.activeMinutes} max={SCORE_WEIGHTS.activeMinutes} />
          <BreakdownRow label={`Workout minutes (target ${SCORE_TARGETS.workoutMinutes})`} value={score.breakdown.workout} max={SCORE_WEIGHTS.workout} />
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            A simple summary of today&apos;s movement, not a medical or fitness measurement.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function BreakdownRow({ label, value, max }: { label: string; value: number; max: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.breakdownRow}>
      <Text style={[typography.caption, { color: colors.text, flex: 1 }]}>{label}</Text>
      <Text style={[typography.caption, { color: colors.textMuted, fontVariant: ['tabular-nums'] }]}>
        {value} / {max}
      </Text>
    </View>
  );
}

export function InsightCard({ insight }: { insight: ActivityInsight }) {
  const { colors } = useTheme();
  return (
    <Card testID={`insight-${insight.type}`}>
      <Text style={[typography.overline, { color: colors.accent }]}>Insight</Text>
      <Text style={[typography.headline, styles.insightTitle, { color: colors.text }]}>{insight.title}</Text>
      <Text style={[typography.body, { color: colors.textMuted }]}>{insight.message}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricCard: { flexBasis: '47%', flexGrow: 1, paddingVertical: spacing.md },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.xs },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden', marginTop: spacing.md },
  fill: { height: '100%', borderRadius: radius.pill },
  disclosure: { marginTop: spacing.md, alignSelf: 'flex-start' },
  breakdown: { marginTop: spacing.sm, gap: spacing.sm },
  breakdownRow: { flexDirection: 'row', alignItems: 'center' },
  insightTitle: { marginTop: spacing.xs, marginBottom: spacing.xs },
});
