import React from 'react';
import { useSimpleBFFAuth } from '~/contexts/SimpleBFFAuthContext';

export const useAuthReadyGateView = () => {
  const { isLoading } = useSimpleBFFAuth();
  const pendingRef = React.useRef<Promise<void> | null>(null);
  const resolveRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    if (!isLoading && resolveRef.current) {
      resolveRef.current();
      resolveRef.current = null;
      pendingRef.current = null;
    }
  }, [isLoading]);

  if (!isLoading) {
    return null;
  }

  if (!pendingRef.current) {
    pendingRef.current = new Promise<void>((resolve) => {
      resolveRef.current = resolve;
    });
  }

  return pendingRef.current;
};
