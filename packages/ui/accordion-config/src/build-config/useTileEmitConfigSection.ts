import { useCallback, useEffect, useMemo } from 'react';
import type {
  BaseBuildConfig,
  DynamicConcurrencyConfig,
} from '@hierarchidb/gis-sdk';
import { getBuildConfigHoverCardSx } from './buildConfigCardStyles.js';

export type UseTileEmitConfigSectionParams<TDataSourceName> = {
  buildConfig: BaseBuildConfig<TDataSourceName>;
  disabled?: boolean;
  disableHoverLift: boolean;
  showConcurrencyCard: boolean;
  update: (partial: Partial<BaseBuildConfig<TDataSourceName>>) => void;
};

export type UseTileEmitConfigSectionResult = {
  dynamicConcurrency: DynamicConcurrencyConfig;
  dynamicConcurrencyActive: boolean;
  hoverCardSx: ReturnType<typeof getBuildConfigHoverCardSx>;
  resolvedMaxConcurrent: number;
  tileToleranceMax: number;
  onAdjustStepChange: (value: string) => void;
  onBufferChange: (value: string) => void;
  onExtentChange: (value: string) => void;
  onIndexMaxPointsChange: (value: string) => void;
  onMaxConcurrentChange: (maxConcurrent: number) => void;
  onSampleMsChange: (value: string) => void;
  onToleranceChange: (value: number | number[]) => void;
  onWatermarkRangeChange: (value: number | number[]) => void;
};

const createDefaultDynamicConcurrency = (
  maxConcurrent: number,
): DynamicConcurrencyConfig => ({
  enabled: false,
  minConcurrent: maxConcurrent,
  maxConcurrent,
  highWatermark: 0.85,
  lowWatermark: 0.6,
  adjustStep: 1,
  sampleMs: 2000,
});

export function useTileEmitConfigSection<TDataSourceName>({
  buildConfig,
  disabled,
  disableHoverLift,
  showConcurrencyCard,
  update,
}: UseTileEmitConfigSectionParams<TDataSourceName>): UseTileEmitConfigSectionResult {
  const tileEmitConfig = buildConfig.tileEmitConfig;

  const resolvedMaxConcurrent = Number.isFinite(tileEmitConfig.maxConcurrent)
    ? tileEmitConfig.maxConcurrent
    : 1;

  const dynamicConcurrency = useMemo(
    () =>
      tileEmitConfig.dynamicConcurrency ??
      createDefaultDynamicConcurrency(resolvedMaxConcurrent),
    [tileEmitConfig.dynamicConcurrency, resolvedMaxConcurrent],
  );

  const dynamicConcurrencyActive =
    showConcurrencyCard && resolvedMaxConcurrent >= 2;
  const tileToleranceMax = Math.max(10, tileEmitConfig.tolerance);
  const hoverCardSx = getBuildConfigHoverCardSx(disabled, disableHoverLift);

  useEffect(() => {
    if (!showConcurrencyCard) {
      return;
    }
    if (dynamicConcurrency.enabled === dynamicConcurrencyActive) {
      return;
    }

    update({
      tileEmitConfig: {
        ...tileEmitConfig,
        dynamicConcurrency: {
          ...dynamicConcurrency,
          enabled: dynamicConcurrencyActive,
        },
      },
    });
  }, [
    dynamicConcurrency,
    dynamicConcurrencyActive,
    showConcurrencyCard,
    tileEmitConfig,
    update,
  ]);

  const onExtentChange = useCallback(
    (value: string) => {
      const extent = Number(value);
      update({
        tileEmitConfig: {
          ...tileEmitConfig,
          extent,
        },
      });
    },
    [tileEmitConfig, update],
  );

  const onToleranceChange = useCallback(
    (value: number | number[]) => {
      if (Array.isArray(value)) {
        return;
      }
      const tolerance = Number(value);
      if (!Number.isFinite(tolerance)) {
        return;
      }
      update({
        tileEmitConfig: {
          ...tileEmitConfig,
          tolerance,
        },
      });
    },
    [tileEmitConfig, update],
  );

  const onBufferChange = useCallback(
    (value: string) => {
      const buffer = Number(value);
      update({
        tileEmitConfig: {
          ...tileEmitConfig,
          buffer,
          bufferSize: buffer,
        },
      });
    },
    [tileEmitConfig, update],
  );

  const onIndexMaxPointsChange = useCallback(
    (value: string) => {
      const indexMaxPoints = Number(value);
      update({
        tileEmitConfig: {
          ...tileEmitConfig,
          indexMaxPoints,
        },
      });
    },
    [tileEmitConfig, update],
  );

  const onMaxConcurrentChange = useCallback(
    (maxConcurrent: number) => {
      update({
        tileEmitConfig: {
          ...tileEmitConfig,
          maxConcurrent,
          dynamicConcurrency: {
            ...dynamicConcurrency,
            enabled: maxConcurrent >= 2,
          },
        },
      });
    },
    [dynamicConcurrency, tileEmitConfig, update],
  );

  const onWatermarkRangeChange = useCallback(
    (value: number | number[]) => {
      if (!Array.isArray(value) || value.length < 2) {
        return;
      }
      const [lowValue, highValue] = value;
      if (typeof lowValue !== 'number' || typeof highValue !== 'number') {
        return;
      }
      if (!Number.isFinite(lowValue) || !Number.isFinite(highValue)) {
        return;
      }

      const lowWatermark = Math.min(lowValue, highValue);
      const highWatermark = Math.max(lowValue, highValue);

      update({
        tileEmitConfig: {
          ...tileEmitConfig,
          dynamicConcurrency: {
            ...dynamicConcurrency,
            lowWatermark,
            highWatermark,
          },
        },
      });
    },
    [dynamicConcurrency, tileEmitConfig, update],
  );

  const onAdjustStepChange = useCallback(
    (value: string) => {
      const adjustStep = Number(value);
      update({
        tileEmitConfig: {
          ...tileEmitConfig,
          dynamicConcurrency: {
            ...dynamicConcurrency,
            adjustStep: Number.isFinite(adjustStep)
              ? adjustStep
              : dynamicConcurrency.adjustStep,
          },
        },
      });
    },
    [dynamicConcurrency, tileEmitConfig, update],
  );

  const onSampleMsChange = useCallback(
    (value: string) => {
      const sampleMs = Number(value);
      update({
        tileEmitConfig: {
          ...tileEmitConfig,
          dynamicConcurrency: {
            ...dynamicConcurrency,
            sampleMs: Number.isFinite(sampleMs)
              ? sampleMs
              : dynamicConcurrency.sampleMs,
          },
        },
      });
    },
    [dynamicConcurrency, tileEmitConfig, update],
  );

  return {
    dynamicConcurrency,
    dynamicConcurrencyActive,
    hoverCardSx,
    resolvedMaxConcurrent,
    tileToleranceMax,
    onAdjustStepChange,
    onBufferChange,
    onExtentChange,
    onIndexMaxPointsChange,
    onMaxConcurrentChange,
    onSampleMsChange,
    onToleranceChange,
    onWatermarkRangeChange,
  };
}
