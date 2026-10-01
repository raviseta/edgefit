import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/ui/navigation';

export default function DashboardLayout() {
  return (
    <Stack screenOptions={useStackScreenOptions()}>
      <Stack.Screen name="index" options={{ title: 'Today' }} />
    </Stack>
  );
}
