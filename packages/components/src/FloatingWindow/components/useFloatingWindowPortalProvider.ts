import { useTheme } from '@mui/material';
import * as React from 'react';
import { FLOATING_WINDOW_ROOT_ID } from './FloatingWindowPortalProvider.js';

type UseFloatingWindowPortalProviderValueParams = {
  zIndex?: number;
};

export function useFloatingWindowPortalProviderValue({
  zIndex,
}: UseFloatingWindowPortalProviderValueParams) {
  const theme = useTheme();
  const resolvedZIndex = zIndex ?? Math.max(theme.zIndex.modal + 10, 0);
  const root = useFloatingWindowPortalRoot(resolvedZIndex);

  return React.useMemo(() => ({ root, isProvider: true }), [root]);
}

export function useFloatingWindowPortalRoot(zIndex: number) {
  const [root, setRoot] = React.useState<HTMLDivElement | null>(null);

  React.useEffect(() => {
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
