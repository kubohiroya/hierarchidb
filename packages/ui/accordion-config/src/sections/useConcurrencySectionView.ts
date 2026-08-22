import { useMemo } from 'react';
import type { ConcurrencyConfig } from './ConcurrencySection.js';

interface ResolvedConcurrencyConfig {
  label: string;
  tooltipText: string;
  defaultLabel: string;
  min: number;
  max: number;
  defaultConcurrency: number;
}

export interface UseConcurrencySectionViewParams {
  config?: ConcurrencyConfig;
}

export interface UseConcurrencySectionViewResult {
  resolvedConfig: ResolvedConcurrencyConfig;
  sliderMarks: Array<{ value: number; label: string }>;
}

const buildDefaultConfig = (): ResolvedConcurrencyConfig => ({
  label: 'Max concurrent processing sessions',
  tooltipText:
    'Controls how many CPU cores are used for processing. Using hardware concurrency (auto-detect) is recommended. Higher values speed up processing but may cause browser instability.',
  defaultLabel: 'Use hardware concurrency default',
  min: 1,
  max: 16,
  defaultConcurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
});

export function useConcurrencySectionView({
  config,
}: UseConcurrencySectionViewParams): UseConcurrencySectionViewResult {
  const resolvedConfig = useMemo<ResolvedConcurrencyConfig>(() => {
    const defaults = buildDefaultConfig();
    return {
      ...defaults,
      ...config,
      min: config?.min ?? defaults.min,
      max: config?.max ?? defaults.max,
      defaultConcurrency: config?.defaultConcurrency ?? defaults.defaultConcurrency,
      label: config?.label ?? defaults.label,
      tooltipText: config?.tooltipText ?? defaults.tooltipText,
      defaultLabel: config?.defaultLabel ?? defaults.defaultLabel,
    };
  }, [config]);

  const sliderMarks = useMemo(
    () => [
      { value: resolvedConfig.min, label: resolvedConfig.min.toString() },
      { value: resolvedConfig.max, label: resolvedConfig.max.toString() },
    ],
    [resolvedConfig.max, resolvedConfig.min]
  );

  return {
    resolvedConfig,
    sliderMarks,
  };
}
