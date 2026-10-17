import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/ui/navigation';

export default function ActivityLayout() {
  return (
    <Stack screenOptions={useStackScreenOptions()}>
      <Stack.Screen name="index" options={{ title: 'Activity' }} />
      <Stack.Screen name="calendar" options={{ title: '30-Day Calendar' }} />
    </Stack>
  );
}
