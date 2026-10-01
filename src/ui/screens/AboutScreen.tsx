import Constants from 'expo-constants';
import { StyleSheet, Text } from 'react-native';

import { SCORE_TARGETS, SCORE_WEIGHTS } from '@/domain/activityScore';
import { Card, Screen, SectionTitle } from '../components/primitives';
import { spacing, typography, useTheme } from '../theme';

export function AboutScreen() {
  const { colors } = useTheme();
  const version = Constants.expoConfig?.version ?? 'dev';
  const p = (text: string) => <Text style={[typography.body, styles.p, { color: colors.textMuted }]}>{text}</Text>;

  return (
    <Screen testID="about">
      <Card>
        <Text style={[typography.title, { color: colors.text }]}>EdgeFit</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Version {version}</Text>
        {p('A privacy-first activity dashboard. EdgeFit reads activity data from Apple Health, processes it on this device, and never uploads it.')}
      </Card>

      <SectionTitle>How the Activity Score works</SectionTitle>
      <Card>
        {p(`${SCORE_WEIGHTS.steps}% steps (full credit at ${SCORE_TARGETS.steps.toLocaleString('en-US')})`)}
        {p(`${SCORE_WEIGHTS.activeMinutes}% active minutes (full credit at ${SCORE_TARGETS.activeMinutes})`)}
        {p(`${SCORE_WEIGHTS.workout}% workout time (full credit at ${SCORE_TARGETS.workoutMinutes} minutes)`)}
        {p('Missing metrics count as zero. Days with no data have no score. The score is a simple summary of movement, not a medical or fitness measurement.')}
      </Card>

      <SectionTitle>How insights work</SectionTitle>
      <Card>
        {p('Insights come from a small set of fixed rules, for example comparing today\'s steps with your average over the previous 7 days. They are not produced by machine learning and are not medical advice.')}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  p: { marginTop: spacing.sm },
});
