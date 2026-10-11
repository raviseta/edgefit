import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HEALTH_DATA_TYPES } from '@/health/HealthService';
import { useServices } from '@/services/ServicesProvider';
import { Button, Card } from '../components/primitives';
import { Icon, IconChip, type IconName } from '../components/visuals';
import { useRequestHealthAccess, useUpdateSettings } from '../hooks';
import { radius, spacing, typography, useTheme } from '../theme';

const STEPS = ['welcome', 'privacy', 'permissions'] as const;
const STEP_ICONS: Record<(typeof STEPS)[number], IconName> = { welcome: 'pulse', privacy: 'shield', permissions: 'heart' };

export function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const { colors } = useTheme();
  const { health } = useServices();
  const update = useUpdateSettings();
  const requestAccess = useRequestHealthAccess();
  const isDemo = health.provider === 'mock';
  const busy = update.isPending || requestAccess.isPending;
  const current = STEPS[step] ?? STEPS[0];

  const finish = () => update.mutate({ onboardingCompleted: true });
  const allow = () => requestAccess.mutate(undefined, { onSettled: finish });
  const skip = () => update.mutate({ onboardingCompleted: true, healthDataEnabled: false });


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroRow}>
          <IconChip name={STEP_ICONS[current]} size={72} color={colors.accent} background={colors.accentSoft} />
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {STEPS.map((s, i) => (
              <View
                key={s}
                style={[
                  styles.dot,
                  { backgroundColor: i === step ? colors.accent : colors.surfaceMuted, width: i === step ? 24 : 8 },
                ]}
              />
            ))}
          </View>
        </View>
        <Text style={[typography.overline, { color: colors.accent }]}>
          Step {step + 1} of {STEPS.length}
        </Text>

        {current === 'welcome' ? (
          <View testID="onboarding-welcome" style={styles.section}>
            <Text accessibilityRole="header" style={[styles.hero, { color: colors.text }]}>
              Welcome to EdgeFit
            </Text>
            <Text style={[typography.body, { color: colors.textMuted }]}>
              See your daily activity, a simple activity score and personalized insights — calculated entirely on your
              phone.
            </Text>
          </View>
        ) : null}

        {current === 'privacy' ? (
          <View testID="onboarding-privacy" style={styles.section}>
            <Text accessibilityRole="header" style={[styles.hero, { color: colors.text }]}>
              Private by design
            </Text>
            <Point title="On-device only" body="Your activity data is processed and stored on this phone. EdgeFit has no servers and no account." />
            <Point title="No tracking" body="No analytics, advertising or third-party tracking SDKs." />
            <Point title="You're in control" body="Clear EdgeFit's local data at any time from Settings." />
          </View>
        ) : null}

        {current === 'permissions' ? (
          <View testID="onboarding-permissions" style={styles.section}>
            <Text accessibilityRole="header" style={[styles.hero, { color: colors.text }]}>
              {isDemo ? 'Demo mode' : 'Health access'}
            </Text>
            <Text style={[typography.body, { color: colors.textMuted }]}>
              {isDemo
                ? "EdgeFit is running without Apple Health, so it can show built-in sample data instead. No real health data will be read."
                : 'EdgeFit asks to read these data types from Apple Health. It never writes to Health.'}
            </Text>
            <Card>
              {HEALTH_DATA_TYPES.map((t) => (
                <View key={t.key} style={styles.listItem}>
                  <Icon name="check" size={18} color={colors.accent} strokeWidth={2.5} />
                  <Text style={[typography.body, { color: colors.text }]}>{t.label}</Text>
                </View>
              ))}
            </Card>
            {!isDemo ? (
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                You can choose which types to allow in the next screen and change it later in the Health app.
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        {current === 'permissions' ? (
          <>
            <Button testID="button-allow-health" title={isDemo ? 'Use Demo Data' : 'Allow Health Access'} onPress={allow} disabled={busy} />
            <Button testID="button-skip-health" title="Continue Without Access" variant="secondary" onPress={skip} disabled={busy} />
          </>
        ) : (
          <Button testID="button-next" title="Continue" onPress={() => setStep((s) => s + 1)} />
        )}
      </View>
    </SafeAreaView>
  );
}

function Point({ title, body }: { title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <Card>
      <Text style={[typography.headline, { color: colors.text }]}>{title}</Text>
      <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.xs }]}>{body}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },
  section: { gap: spacing.md },
  hero: { fontSize: 32, fontWeight: '800', marginTop: spacing.sm, letterSpacing: -0.5 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  dots: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  dot: { height: 8, borderRadius: radius.pill },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { padding: spacing.xl, paddingTop: spacing.sm, gap: spacing.md },
});
