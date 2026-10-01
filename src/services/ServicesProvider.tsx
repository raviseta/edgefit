import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { logger } from '@/lib/logger';
import type { AppServices } from './createAppServices';

const ServicesContext = createContext<AppServices | null>(null);

type InitState = { status: 'loading' } | { status: 'ready'; services: AppServices } | { status: 'error' };

interface ServicesProviderProps {
  /** Async factory (app) — opens the database and wires dependencies. */
  create: () => Promise<AppServices>;
  children: ReactNode;
  renderLoading: () => ReactNode;
  renderError: (retry: () => void) => ReactNode;
}

/**
 * Dependency-injection root. If the database cannot be opened or migrated the
 * app shows a recoverable error instead of crashing.
 */
export function ServicesProvider({ create, children, renderLoading, renderError }: ServicesProviderProps) {
  const [state, setState] = useState<InitState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    create().then(
      (services) => !cancelled && setState({ status: 'ready', services }),
      (error) => {
        logger.error('services.init_failed', error, { attempt });
        if (!cancelled) setState({ status: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [create, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  if (state.status === 'loading') return renderLoading();
  if (state.status === 'error') return renderError(retry);
  return <ServicesContext.Provider value={state.services}>{children}</ServicesContext.Provider>;
}

/** Test/preview helper: provide already-built services synchronously. */
export function StaticServicesProvider({ services, children }: { services: AppServices; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside ServicesProvider');
  return services;
}
