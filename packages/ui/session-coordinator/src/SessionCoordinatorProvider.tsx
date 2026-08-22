import {
  type TabSessionCoordinator,
  type TabSessionCoordinatorOptions,
} from '@hierarchidb/session-coordinator';
import { createContext, type PropsWithChildren, useContext } from 'react';
import { useTabSessionCoordinatorProviderView } from './useTabSessionCoordinatorProviderView.js';

type TabSessionCoordinatorProviderProps = PropsWithChildren<{
  options?: TabSessionCoordinatorOptions;
}>;

const TabSessionCoordinatorContext = createContext<TabSessionCoordinator | null>(null);

export const TabSessionCoordinatorProvider = ({
  children,
  options,
}: TabSessionCoordinatorProviderProps) => {
  const { coordinator } = useTabSessionCoordinatorProviderView({ options });
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
