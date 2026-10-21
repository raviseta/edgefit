import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PersonalInsightCard, PersonalInsights } from '@/intelligence/personalInsights';
import { spacing, typography, useTheme } from '../theme';
import { Card, SectionTitle } from './primitives';

/**
 * Dashboard section for the two-week Personal Activity Insights. Pure
 * presentation: eligibility, numbers and wording all come from
 * `buildPersonalInsights`.
 */
export function PersonalInsightsSection({ insights }: { insights: PersonalInsights }) {
  const { colors } = useTheme();
  const results = [insights.activityConsistency, insights.weeklySteps, insights.exerciseFrequency];

  return (
    <View testID="personal-insights" style={styles.section}>
      <SectionTitle>Personal Activity Insights</SectionTitle>
      {!insights.hasAnyHistory ? (
        <Card testID="personal-insights-empty">
          <Text style={[typography.body, { color: colors.textMuted }]}>
            Insights appear once EdgeFit has saved a few days of activity on this device.
          </Text>
        </Card>
      ) : (
        results.map((result) =>
          result.status === 'eligible' ? (
            <PersonalInsightCardView key={result.kind} testID={`personal-insight-${result.kind}`} card={result.card} />
          ) : (
            <Card key={result.kind} testID={`personal-insight-unavailable-${result.kind}`}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{result.message}</Text>
            </Card>
          ),
        )
      )}
    </View>
  );
}

function PersonalInsightCardView({ card, testID }: { card: PersonalInsightCard; testID: string }) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  return (
    <Card testID={testID}>
      <Text style={[typography.overline, { color: colors.accent }]}>{card.title}</Text>
      <Text style={[typography.headline, styles.observation, { color: colors.text }]}>{card.observation}</Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{card.period}</Text>
      {card.details.map((detail) => (
        <Text key={detail} style={[typography.caption, styles.detail, { color: colors.textMuted }]}>
          {detail}
        </Text>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((e) => !e)}
        hitSlop={8}
        style={styles.disclosure}
      >
        <Text style={[typography.caption, styles.disclosureText, { color: colors.accent }]}>
          {expanded ? 'Hide calculation' : 'How is this calculated?'}
        </Text>
      </Pressable>
      {expanded ? (
        <Text testID={`${testID}-explanation`} style={[typography.caption, styles.detail, { color: colors.textMuted }]}>
          {card.explanation}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  observation: { marginTop: spacing.xs, marginBottom: spacing.xs },
  detail: { marginTop: spacing.xs },
  disclosure: { marginTop: spacing.md, alignSelf: 'flex-start' },
  disclosureText: { textDecorationLine: 'underline' },
});
