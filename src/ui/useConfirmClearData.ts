import { Alert } from 'react-native';

import { useClearLocalData } from './hooks';

/** Confirm-then-clear flow shared by Settings and the Privacy Center. */
export function useConfirmClearData() {
  const clear = useClearLocalData();
  const confirm = () =>
    Alert.alert(
      'Clear local data?',
      'This deletes all activity summaries, cached workouts, insights and settings stored by EdgeFit on this device. Data in the Health app is not affected. You will see onboarding again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: () =>
            clear.mutate(undefined, {
              onError: () => Alert.alert('Could not clear data', 'Please try again.'),
            }),
        },
      ],
    );
  return { confirm, isPending: clear.isPending };
}
