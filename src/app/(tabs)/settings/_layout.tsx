import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/ui/navigation';

export default function SettingsLayout() {
  const options = useStackScreenOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="privacy" options={{ title: 'Your Privacy' }} />
      <Stack.Screen name="about" options={{ title: 'About' }} />
    </Stack>
  );
}
