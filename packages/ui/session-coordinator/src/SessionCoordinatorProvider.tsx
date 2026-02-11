import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import {
  createSessionCoordinator,
  type SessionCoordinator,
  type SessionCoordinatorOptions,
} from '@hierarchidb/session-coordinator';

type SessionCoordinatorProviderProps = PropsWithChildren<{
  options?: SessionCoordinatorOptions;
}>;

const SessionCoordinatorContext = createContext<SessionCoordinator | null>(null);

export const SessionCoordinatorProvider = ({ children, options }: SessionCoordinatorProviderProps) => {
  const coordinator = useMemo(() => (
    createSessionCoordinator(options)
  ), [
    options?.channelName,
    options?.pollIntervalTimeout,
    options?.quietThresholdTimeout,
    options?.storage,
    options?.storageKeys,
    options?.now,
  ]);
  return (
    <SessionCoordinatorContext.Provider value={coordinator}>
      {children}
    </SessionCoordinatorContext.Provider>
  );
};

export const useSessionCoordinator = (): SessionCoordinator => {
  const value = useContext(SessionCoordinatorContext);
  if (!value) {
    throw new Error('useSessionCoordinator must be used within SessionCoordinatorProvider');
  }
  return value;
};
