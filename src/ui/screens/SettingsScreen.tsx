import { router } from 'expo-router';

import { Screen, SectionTitle } from '../components/primitives';
import { Row, RowGroup, SegmentedRow, SwitchRow } from '../components/SettingsRows';
import { ErrorState, LoadingState } from '../components/StateViews';
import { useRequestHealthAccess, useSettings, useUpdateSettings } from '../hooks';
import { useConfirmClearData } from '../useConfirmClearData';
import { useServices } from '@/services/ServicesProvider';
import { RETENTION_DAYS } from '@/services/SyncService';

const ENERGY_UNITS = ['kcal', 'kJ'] as const;

export function SettingsScreen() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const requestAccess = useRequestHealthAccess();
  const clearData = useConfirmClearData();
  const { health } = useServices();

  if (settings.isPending) {
    return (
      <Screen>
        <LoadingState label="Loading settings…" />
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

  const s = settings.data;
  const isDemo = health.provider === 'mock';

  const toggleHealth = (enabled: boolean) => {
    if (enabled) requestAccess.mutate();
    else update.mutate({ healthDataEnabled: false });
  };

  return (
    <Screen testID="settings">
      <SectionTitle>Privacy</SectionTitle>
      <RowGroup>
        <Row first label="Privacy Center" onPress={() => router.push('/settings/privacy')} testID="row-privacy" />
      </RowGroup>

      <SectionTitle>Health permissions</SectionTitle>
      <RowGroup
        footer={
          isDemo
            ? 'EdgeFit is running with built-in demo data instead of Apple Health.'
            : 'Turning this off stops EdgeFit from reading Health. To change which data types EdgeFit may read, open the Health app → your profile → Apps → EdgeFit.'
        }
      >
        <SwitchRow
          first
          testID="switch-health"
          label={isDemo ? 'Use demo health data' : 'Read data from Apple Health'}
          value={s.healthDataEnabled}
          disabled={requestAccess.isPending || update.isPending}
          onValueChange={toggleHealth}
        />
      </RowGroup>

      <SectionTitle>Preferences</SectionTitle>
      <RowGroup footer="Insights are generated on this device by simple, transparent rules. Nothing is sent anywhere.">
        <SegmentedRow
          first
          label="Energy units"
          options={ENERGY_UNITS}
          value={s.energyUnit}
          onChange={(energyUnit) => update.mutate({ energyUnit })}
        />
        <SwitchRow
          testID="switch-insights"
          label="Personalized insights"
          value={s.analyticsEnabled}
          onValueChange={(analyticsEnabled) => update.mutate({ analyticsEnabled })}
        />
      </RowGroup>

      <SectionTitle>Data</SectionTitle>
      <RowGroup footer={`EdgeFit keeps processed summaries for up to ${RETENTION_DAYS} days, only on this device.`}>
        <Row first destructive label="Clear Local Data" onPress={clearData.confirm} testID="row-clear-data" />
      </RowGroup>

      <SectionTitle>About</SectionTitle>
      <RowGroup>
        <Row first label="About EdgeFit" onPress={() => router.push('/settings/about')} />
      </RowGroup>
    </Screen>
  );
}
