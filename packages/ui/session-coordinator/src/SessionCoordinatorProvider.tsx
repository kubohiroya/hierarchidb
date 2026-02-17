import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import {
  createTabSessionCoordinator,
  type TabSessionCoordinator,
  type TabSessionCoordinatorOptions,
} from '@hierarchidb/session-coordinator';

type TabSessionCoordinatorProviderProps = PropsWithChildren<{
  options?: TabSessionCoordinatorOptions;
}>;

const TabSessionCoordinatorContext = createContext<TabSessionCoordinator | null>(null);

export const TabSessionCoordinatorProvider = ({ children, options }: TabSessionCoordinatorProviderProps) => {
  const coordinator = useMemo(() => (
    createTabSessionCoordinator(options)
  ), [
    options?.channelName,
    options?.pollIntervalTimeout,
    options?.quietThresholdTimeout,
    options?.storage,
    options?.storageKeys,
    options?.now,
  ]);
  return (
    <TabSessionCoordinatorContext.Provider value={coordinator}>
      {children}
    </TabSessionCoordinatorContext.Provider>
  );
};

export const useTabSessionCoordinator = (): TabSessionCoordinator => {
  const value = useContext(TabSessionCoordinatorContext);
  if (!value) {
    throw new Error('useTabSessionCoordinator must be used within TabSessionCoordinatorProvider');
  }
  return value;
};

/** @deprecated Use TabSessionCoordinatorProvider. */
export const SessionCoordinatorProvider = TabSessionCoordinatorProvider;
/** @deprecated Use useTabSessionCoordinator. */
export const useSessionCoordinator = useTabSessionCoordinator;
