import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import type { AppSettings } from '@/domain/models';
import { logger } from '@/lib/logger';
import { useServices } from '@/services/ServicesProvider';

export const queryKeys = {
  settings: ['settings'] as const,
  snapshot: ['snapshot'] as const,
  /** Nested under `snapshot` so anything that invalidates the snapshot also refreshes the calendar. */
  calendar: ['snapshot', 'calendar'] as const,
  permission: ['permission-status'] as const,
};

export function useSettings() {
  const { repositories } = useServices();
  return useQuery({ queryKey: queryKeys.settings, queryFn: () => repositories.settings.get() });
}

/** Syncs from the health provider, then reads the local store. Pull-to-refresh calls `refetch`. */
export function useActivitySnapshot() {
  const { activity } = useServices();
  return useQuery({ queryKey: queryKeys.snapshot, queryFn: () => activity.refresh() });
}

/**
 * The 30-day calendar. It never syncs by itself: it rides on the activity
 * snapshot (which syncs exactly as on the other tabs) and re-reads local storage
 * whenever that snapshot updates, so it always reflects the latest sync.
 */
export function useActivityCalendar() {
  const { activity } = useServices();
  const snapshot = useActivitySnapshot();
  const calendar = useQuery({
    queryKey: [...queryKeys.calendar, snapshot.dataUpdatedAt],
    queryFn: () => activity.getCalendar(),
    enabled: snapshot.isSuccess,
    placeholderData: keepPreviousData,
  });
  return { snapshot, calendar };
}

export function usePermissionStatus() {
  const { health } = useServices();
  return useQuery({
    queryKey: queryKeys.permission,
    queryFn: async () => {
      try {
        return await health.getPermissionRequestStatus();
      } catch (error) {
        logger.warn('health.permission_status_failed', error, { provider: health.provider });
        return 'unknown' as const;
      }
    },
  });
}

export function useUpdateSettings() {
  const { repositories } = useServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AppSettings>) => repositories.settings.update(patch),
    onSuccess: (settings) => {
      client.setQueryData(queryKeys.settings, settings);
      return client.invalidateQueries({ queryKey: queryKeys.snapshot });
    },
  });
}

/** Shows the OS health permission prompt and records the outcome. */
export function useRequestHealthAccess() {
  const { health, repositories } = useServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await health.requestAuthorization();
      return repositories.settings.update({
        healthPermissionRequested: true,
        healthDataEnabled: result.status === 'requested',
      });
    },
    onSuccess: async (settings) => {
      client.setQueryData(queryKeys.settings, settings);
      await client.invalidateQueries({ queryKey: queryKeys.permission });
      await client.invalidateQueries({ queryKey: queryKeys.snapshot });
    },
    onError: (error) => {
      logger.error('health.authorization_failed', error, { provider: health.provider });
      Alert.alert(
        "Couldn't request Health access",
        `You can try again from Settings.${__DEV__ && error instanceof Error ? `\n\n${error.message}` : ''}`,
      );
    },
  });
}

export function useClearLocalData() {
  const { activity } = useServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => activity.clearLocalData(),
    onSuccess: () => client.resetQueries(),
    onError: (error) => logger.error('storage.clear_failed', error),
  });
}
