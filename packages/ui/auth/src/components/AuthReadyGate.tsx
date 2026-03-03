import React from 'react';
import { useAuthReadyGateView } from './useAuthReadyGateView.js';

type AuthReadyGateProps = {
  children: React.ReactNode;
};

export function AuthReadyGate({ children }: AuthReadyGateProps) {
  const pendingPromise = useAuthReadyGateView();
  if (pendingPromise) {
    throw pendingPromise;
  }

  return <>{children}</>;
}
