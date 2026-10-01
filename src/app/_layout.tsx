import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { SqliteDatabase } from '@/data/SqliteDatabase';
import { createHealthService } from '@/health/createHealthService';
import { createAppServices } from '@/services/createAppServices';
import { ServicesProvider } from '@/services/ServicesProvider';
import { ErrorState, LoadingState } from '@/ui/components/StateViews';
import { useSettings } from '@/ui/hooks';
import { spacing, useTheme } from '@/ui/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
});

const createServices = async () =>
  createAppServices({ db: await SqliteDatabase.open(), health: createHealthService() });

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  const base = isDark ? DarkTheme : DefaultTheme;

  // Refresh stale data when the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, primary: colors.accent, background: colors.background, card: colors.surface, text: colors.text },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ServicesProvider
          create={createServices}
          renderLoading={() => <LoadingState fullScreen label="Starting EdgeFit…" />}
          renderError={(retry) => (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
              <ErrorState
                title="Couldn't open local storage"
                message="EdgeFit keeps your activity summaries in an on-device database, which couldn't be opened. Nothing has been sent anywhere."
                onRetry={retry}
              />
            </View>
          )}
        >
          <RootNavigator />
        </ServicesProvider>
      </QueryClientProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

function RootNavigator() {
  const settings = useSettings();
  const { colors } = useTheme();

  if (settings.isPending) return <LoadingState fullScreen label="Starting EdgeFit…" />;
  if (settings.isError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ErrorState onRetry={() => settings.refetch()} />
      </View>
    );
  }

  const onboarded = settings.data.onboardingCompleted;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: spacing.lg },
});
