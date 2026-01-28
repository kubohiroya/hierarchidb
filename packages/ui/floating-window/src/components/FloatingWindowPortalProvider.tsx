import { useTheme } from '@mui/material';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export const FLOATING_WINDOW_ROOT_ID = 'hdb-floating-window-root';
export const DEFAULT_FLOATING_WINDOW_Z_INDEX = 1310;

type FloatingWindowPortalContextValue = {
  root: HTMLElement | null;
  isProvider: boolean;
};

const FloatingWindowPortalContext = createContext<FloatingWindowPortalContextValue>({
  root: null,
  isProvider: false,
});

export const useFloatingWindowPortal = () => useContext(FloatingWindowPortalContext);

export function FloatingWindowPortalProvider({
  children,
  zIndex,
}: {
  children: ReactNode;
  zIndex?: number;
}) {
  const theme = useTheme();
  const resolvedZIndex = zIndex ?? Math.max(theme.zIndex.modal + 10, 0);
  const root = useFloatingWindowPortalRoot(resolvedZIndex);
  const contextValue = useMemo(() => ({ root, isProvider: true }), [root]);

  return (
    <FloatingWindowPortalContext.Provider value={contextValue}>
      {children}
    </FloatingWindowPortalContext.Provider>
  );
}

export function useFloatingWindowPortalRoot(zIndex: number) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const body = document.body;
    if (!body) return undefined;

    let element = document.getElementById(FLOATING_WINDOW_ROOT_ID) as HTMLDivElement | null;
    if (!element) {
      element = document.createElement('div');
      element.id = FLOATING_WINDOW_ROOT_ID;
      element.style.position = 'fixed';
      element.style.inset = '0';
      element.style.pointerEvents = 'none';
      body.appendChild(element);
    }
    element.style.zIndex = String(zIndex);
    setRoot(element);

    return () => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
      setRoot(null);
    };
  }, [zIndex]);

  return root;
}
