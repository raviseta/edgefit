import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/ui/navigation';

export default function WorkoutsLayout() {
  return (
    <Stack screenOptions={useStackScreenOptions()}>
      <Stack.Screen name="index" options={{ title: 'Workouts' }} />
    </Stack>
  );
}
