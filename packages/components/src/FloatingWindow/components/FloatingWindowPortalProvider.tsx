import type { ReactNode } from 'react';
import * as React from 'react';
import {
  useFloatingWindowPortalProviderValue,
  useFloatingWindowPortalRoot,
} from './useFloatingWindowPortalProvider.js';

export const FLOATING_WINDOW_ROOT_ID = 'hdb-floating-window-root';
export const DEFAULT_FLOATING_WINDOW_Z_INDEX = 1310;

type FloatingWindowPortalContextValue = {
  root: HTMLElement | null;
  isProvider: boolean;
};

export const FloatingWindowPortalContext = React.createContext<FloatingWindowPortalContextValue>({
  root: null,
  isProvider: false,
});

export function FloatingWindowPortalProvider({
  children,
  zIndex,
}: {
  children: ReactNode;
  zIndex?: number;
}) {
  const contextValue = useFloatingWindowPortalProviderValue({ zIndex });

  return (
    <FloatingWindowPortalContext.Provider value={contextValue}>
      {children}
    </FloatingWindowPortalContext.Provider>
  );
}
export { useFloatingWindowPortalRoot };
