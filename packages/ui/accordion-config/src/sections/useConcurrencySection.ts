import { Calculate } from '@mui/icons-material';
import type { ReactNode } from 'react';
import { createElement, useId, useMemo } from 'react';
import type { ConcurrencyConfig } from './ConcurrencySection.js';

export interface UseConcurrencySectionParams {
  config?: ConcurrencyConfig;
}

export interface UseConcurrencySectionResult {
  icon: ReactNode;
  switchInputProps: {
    id: string;
    name: string;
  };
}

export function useConcurrencySection({
  config,
}: UseConcurrencySectionParams): UseConcurrencySectionResult {
  const switchId = useId();

  const icon = useMemo<ReactNode>(() => config?.icon ?? createElement(Calculate), [config?.icon]);

  return {
    icon,
    switchInputProps: {
      id: `${switchId}-use-default-concurrency`,
      name: 'use-default-concurrency',
    },
  };
}
