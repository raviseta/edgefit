import { Redirect } from 'expo-router';

import { useSettings } from '@/ui/hooks';

/** Entry route: send first-time users to onboarding, everyone else to the dashboard. */
export default function Index() {
  const settings = useSettings();
  if (!settings.data) return null;
  return <Redirect href={settings.data.onboardingCompleted ? '/dashboard' : '/onboarding'} />;
}
