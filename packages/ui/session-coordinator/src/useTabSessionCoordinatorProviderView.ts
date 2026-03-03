import { useMemo } from 'react';
import {
  createTabSessionCoordinator,
  type TabSessionCoordinator,
  type TabSessionCoordinatorOptions,
} from '@hierarchidb/session-coordinator';

export interface UseTabSessionCoordinatorProviderViewParams {
  options?: TabSessionCoordinatorOptions;
}

export interface UseTabSessionCoordinatorProviderViewResult {
  coordinator: TabSessionCoordinator;
}

export function useTabSessionCoordinatorProviderView({
  options,
}: UseTabSessionCoordinatorProviderViewParams): UseTabSessionCoordinatorProviderViewResult {
  const coordinator = useMemo(
    () => createTabSessionCoordinator(options),
    [
      options?.channelName,
      options?.pollIntervalTimeout,
      options?.quietThresholdTimeout,
      options?.storage,
      options?.storageKeys,
      options?.now,
    ],
  );

  return {
    coordinator,
  };
}
