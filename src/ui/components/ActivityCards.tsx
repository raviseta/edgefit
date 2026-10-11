import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { calculateActivityScore, SCORE_TARGETS, SCORE_WEIGHTS } from '@/domain/activityScore';
import type { ActivityInsight, DailySummary } from '@/domain/models';
import { EMPTY_VALUE } from '@/lib/format';
import { radius, spacing, typography, useTheme } from '../theme';
import { Card } from './primitives';
import { GradientBackground, IconChip, ProgressRing, type IconName } from './visuals';

export type MetricKind = 'steps' | 'energy' | 'time' | 'workouts';

const METRIC_STYLE: Record<MetricKind, { icon: IconName; color: 'metricSteps' | 'metricEnergy' | 'metricTime' | 'metricWorkouts'; soft: 'metricStepsSoft' | 'metricEnergySoft' | 'metricTimeSoft' | 'metricWorkoutsSoft' }> = {
  steps: { icon: 'steps', color: 'metricSteps', soft: 'metricStepsSoft' },
  energy: { icon: 'energy', color: 'metricEnergy', soft: 'metricEnergySoft' },
  time: { icon: 'clock', color: 'metricTime', soft: 'metricTimeSoft' },
  workouts: { icon: 'dumbbell', color: 'metricWorkouts', soft: 'metricWorkoutsSoft' },
};

export function MetricCard({
  label,
  value,
  unit,
  testID,
  kind = 'steps',
}: {
  label: string;
  value: string;
  unit?: string;
  testID?: string;
  kind?: MetricKind;
}) {
  const { colors } = useTheme();
  const missing = value === EMPTY_VALUE;
  const m = METRIC_STYLE[kind];
  return (
    <Card testID={testID} style={styles.metricCard}>
      <View accessible accessibilityLabel={`${label}: ${missing ? 'no data' : `${value}${unit ? ` ${unit}` : ''}`}`}>
        <IconChip name={m.icon} color={colors[m.color]} background={colors[m.soft]} />
        <Text style={[typography.metric, styles.metricValue, { color: missing ? colors.textMuted : colors.text }]}>
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

  const total = score?.total ?? 0;

  return (
    <View testID="score-card" style={styles.hero}>
      <GradientBackground from={colors.heroStart} to={colors.heroEnd} />
      <View style={styles.heroBody}>
        <View
          accessible
          accessibilityLabel={score ? `Activity score ${score.total} out of 100` : 'Activity score unavailable'}
          style={styles.heroRow}
        >
          <ProgressRing progress={total / 100} size={112} strokeWidth={11} color={colors.onHero} trackColor="rgba(255,255,255,0.25)">
            <Text style={[typography.score, { color: colors.onHero }]}>{score ? score.total : EMPTY_VALUE}</Text>
          </ProgressRing>
          <View style={styles.heroText}>
            <Text style={[typography.overline, { color: colors.onHero, opacity: 0.8 }]}>Activity Score</Text>
            <Text style={[typography.headline, { color: colors.onHero }]}>{scoreHeadline(score?.total)}</Text>
            <Text style={[typography.caption, { color: colors.onHero, opacity: 0.8 }]}>out of 100</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((e) => !e)}
          hitSlop={8}
          style={styles.disclosure}
        >
          <Text style={[typography.caption, styles.disclosureText, { color: colors.onHero }]}>
            {expanded ? 'Hide calculation' : 'How is this calculated?'}
          </Text>
        </Pressable>
        {expanded && score ? (
          <View testID="score-breakdown" style={styles.breakdown}>
            <BreakdownRow label={`Steps (target ${SCORE_TARGETS.steps.toLocaleString('en-US')})`} value={score.breakdown.steps} max={SCORE_WEIGHTS.steps} />
            <BreakdownRow label={`Active minutes (target ${SCORE_TARGETS.activeMinutes})`} value={score.breakdown.activeMinutes} max={SCORE_WEIGHTS.activeMinutes} />
            <BreakdownRow label={`Workout minutes (target ${SCORE_TARGETS.workoutMinutes})`} value={score.breakdown.workout} max={SCORE_WEIGHTS.workout} />
            <Text style={[typography.caption, { color: colors.onHero, opacity: 0.8 }]}>
              A simple summary of today&apos;s movement, not a medical or fitness measurement.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function scoreHeadline(total: number | undefined): string {
  if (total === undefined) return 'Not enough data yet';
  if (total >= 80) return 'Great day';
  if (total >= 50) return 'Solid progress';
  if (total >= 20) return 'Getting started';
  return 'Just warming up';
}

function BreakdownRow({ label, value, max }: { label: string; value: number; max: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.breakdownRow}>
      <Text style={[typography.caption, { color: colors.onHero, flex: 1 }]}>{label}</Text>
      <Text style={[typography.caption, { color: colors.onHero, fontVariant: ['tabular-nums'] }]}>
        {value} / {max}
      </Text>
    </View>
  );
}

export function InsightCard({ insight }: { insight: ActivityInsight }) {
  const { colors } = useTheme();
  return (
    <Card testID={`insight-${insight.type}`} style={[styles.insight, { backgroundColor: colors.accentSoft }]}>
      <IconChip name="bulb" color={colors.accent} background={colors.surface} />
      <View style={styles.insightText}>
        <Text style={[typography.overline, { color: colors.accent }]}>Insight</Text>
        <Text style={[typography.headline, styles.insightTitle, { color: colors.text }]}>{insight.title}</Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>{insight.message}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricCard: { flexBasis: '47%', flexGrow: 1 },
  metricValue: { marginTop: spacing.md },
  hero: { borderRadius: radius.xl, overflow: 'hidden' },
  heroBody: { padding: spacing.xl },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  heroText: { flex: 1, gap: 2 },
  disclosure: { marginTop: spacing.lg, alignSelf: 'flex-start' },
  disclosureText: { textDecorationLine: 'underline' },
  breakdown: { marginTop: spacing.md, gap: spacing.sm },
  breakdownRow: { flexDirection: 'row', alignItems: 'center' },
  insight: { flexDirection: 'row', gap: spacing.md },
  insightText: { flex: 1 },
  insightTitle: { marginTop: spacing.xs, marginBottom: spacing.xs },
});
