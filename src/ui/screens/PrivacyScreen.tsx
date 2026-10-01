import { StyleSheet, Text, View } from 'react-native';

import { HEALTH_DATA_TYPES, type PermissionRequestStatus } from '@/health/HealthService';
import { useServices } from '@/services/ServicesProvider';
import { RETENTION_DAYS } from '@/services/SyncService';
import { Button, Card, Screen, SectionTitle } from '../components/primitives';
import { Row, RowGroup } from '../components/SettingsRows';
import { ErrorState, LoadingState } from '../components/StateViews';
import { usePermissionStatus, useSettings } from '../hooks';
import { spacing, typography, useTheme } from '../theme';
import { useConfirmClearData } from '../useConfirmClearData';

/**
 * Every statement here must stay true to the implementation. If a feature
 * that sends data anywhere is ever added, this screen must change with it.
 */
export function PrivacyScreen() {
  const settings = useSettings();
  const permission = usePermissionStatus();
  const { health, intelligence } = useServices();
  const clearData = useConfirmClearData();
  const { colors } = useTheme();

  if (settings.isPending) {
    return (
      <Screen>
        <LoadingState label="Loading…" />
      </Screen>
    );
  }
  if (settings.isError) {
    return (
      <Screen>
        <ErrorState onRetry={() => settings.refetch()} />
      </Screen>
    );
  }

  const isDemo = health.provider === 'mock';
  const permissionLabel = permissionStatusLabel(isDemo, permission.data);

  return (
    <Screen testID="privacy">
      <PrivacyItem
        title="Health data"
        body={
          isDemo
            ? 'EdgeFit is running with built-in demo data instead of Apple Health. No real health data is read.'
            : 'Read from Apple Health to calculate your activity metrics. EdgeFit only reads; it never writes to Health.'
        }
      />
      <PrivacyItem
        title="Storage"
        body={`Stored locally on this device. EdgeFit saves daily totals, workout summaries, insights and settings in an on-device database and deletes them after ${RETENTION_DAYS} days. Individual health samples are not copied.`}
      />
      <PrivacyItem
        title="Cloud processing"
        body="Not used by EdgeFit. There is no EdgeFit account, server, analytics, advertising or tracking SDK, and EdgeFit does not send your data off this device."
      />
      <PrivacyItem
        title="Insight processing"
        body={
          intelligence.method === 'rule-based'
            ? 'Performed locally using simple, transparent rules that compare today with your recent days. This is not machine learning and not medical advice.'
            : 'Performed locally by an on-device model. Not medical advice.'
        }
      />
      <Text style={[typography.caption, styles.note, { color: colors.textMuted }]}>
        Apple Health itself may sync across your devices through iCloud according to your Apple settings. That is
        managed by Apple, not EdgeFit.
      </Text>

      <SectionTitle>Health permissions</SectionTitle>
      <RowGroup
        footer={
          isDemo
            ? undefined
            : 'iOS does not tell apps whether read access was granted. To review or change it, open the Health app → your profile → Apps → EdgeFit.'
        }
      >
        <Row first label="EdgeFit reading Health" value={settings.data.healthDataEnabled ? 'On' : 'Off'} testID="perm-enabled" />
        {HEALTH_DATA_TYPES.map((type) => (
          <Row key={type.key} label={type.label} value={permissionLabel} testID={`perm-${type.key}`} />
        ))}
      </RowGroup>

      <View style={styles.clear}>
        <Button
          testID="button-clear-data"
          title="Clear Local Data"
          variant="destructive"
          disabled={clearData.isPending}
          onPress={clearData.confirm}
        />
      </View>
    </Screen>
  );
}

function permissionStatusLabel(isDemo: boolean, status: PermissionRequestStatus | undefined): string {
  if (isDemo) return 'Demo data';
  switch (status) {
    case 'requested':
      return 'Requested';
    case 'shouldRequest':
      return 'Not requested';
    default:
      return 'Unknown';
  }
}

function PrivacyItem({ title, body }: { title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <Card>
      <Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[typography.body, styles.body, { color: colors.textMuted }]}>{body}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: spacing.xs },
  note: { marginHorizontal: spacing.xs },
  clear: { marginTop: spacing.lg },
});
