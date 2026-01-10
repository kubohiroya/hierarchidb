import React from 'react';
import { useSimpleBFFAuth } from '../contexts/SimpleBFFAuthContext.js';

type AuthReadyGateProps = {
  children: React.ReactNode;
};

export function AuthReadyGate({ children }: AuthReadyGateProps) {
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

  if (isLoading) {
    if (!pendingRef.current) {
      pendingRef.current = new Promise<void>((resolve) => {
        resolveRef.current = resolve;
      });
    }
    throw pendingRef.current;
  }

  return <>{children}</>;
}
