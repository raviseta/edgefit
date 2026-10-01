import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import type { AppServices } from '@/services/createAppServices';
import { StaticServicesProvider } from '@/services/ServicesProvider';

export function renderWithServices(ui: ReactElement, services: AppServices) {
  // gcTime: Infinity avoids React Query's garbage-collection timers, which would keep Jest alive.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <StaticServicesProvider services={services}>{ui}</StaticServicesProvider>
    </QueryClientProvider>,
  );
}
