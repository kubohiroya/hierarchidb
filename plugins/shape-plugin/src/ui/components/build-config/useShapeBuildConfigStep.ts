import { useCallback, useEffect, useMemo } from 'react';
import {
  resolveZoomBandSettings,
  TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES,
  loadTreeConsoleSettings,
  normalizeZoomBandBoundaries,
  areZoomBandBoundariesEqual,
  ZOOM_BAND_MIN_ZOOM,
  ZOOM_BAND_MAX_ZOOM,
  ZOOM_BAND_MAX_RANGES,
} from '@hierarchidb/util';
import {
  DEFAULT_BUILD_CONFIG,
  DEFAULT_PROCESSING_CONFIG,
  applyBuildConfigPatch,
  mergeProcessingConfig,
} from '~/common/types/index';
import type { ShapeEntity } from '~/common/types/index';
import type { ShapeBuildConfig } from '~/common/types/index';

type Args = {
  data: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
};

const resolveInitialBuildConfig = (): ShapeBuildConfig => {
  const settings = loadTreeConsoleSettings();
  const { boundaries: zoomBandBoundaries } = resolveZoomBandSettings({
    commonBoundaries: settings.zoomBandBoundaries,
    fallbackBoundaries: TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES,
    preferCommon: true,
  });
  return {
    ...DEFAULT_BUILD_CONFIG,
    geometryConfig: {
      ...DEFAULT_BUILD_CONFIG.geometryConfig,
      zoomBandBoundaries,
    },
  };
};

const normalizeZoomBandConfig = (
  baseConfig: ShapeBuildConfig,
  overrides?: Partial<ShapeBuildConfig>,
): ShapeBuildConfig => {
  const merged = overrides ? applyBuildConfigPatch(baseConfig, overrides) : baseConfig;
  const rawBoundaries = merged.geometryConfig.zoomBandBoundaries;
  const normalizedBoundaries = normalizeZoomBandBoundaries(
    Array.isArray(rawBoundaries) ? rawBoundaries : baseConfig.geometryConfig.zoomBandBoundaries,
    ZOOM_BAND_MIN_ZOOM,
    ZOOM_BAND_MAX_ZOOM,
    ZOOM_BAND_MAX_RANGES,
  );
  if (areZoomBandBoundariesEqual(rawBoundaries, normalizedBoundaries)) {
    return merged;
  }
  return {
    ...merged,
    geometryConfig: {
      ...merged.geometryConfig,
      zoomBandBoundaries: normalizedBoundaries,
    },
  };
};

const isStepValueEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

export const useShapeBuildConfigStep = ({ data, onChange }: Args) => {
  const config = useMemo(() => {
    const baseConfig = resolveInitialBuildConfig();
    return normalizeZoomBandConfig(baseConfig, data?.buildConfig);
  }, [data?.buildConfig]);

  useEffect(() => {
    const baseConfig = resolveInitialBuildConfig();
    const nextProcessingConfig = data?.processingConfig
      ? mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, data.processingConfig)
      : DEFAULT_PROCESSING_CONFIG;
    if (!data?.buildConfig) {
      onChange({
        buildConfig: baseConfig,
        processingConfig: nextProcessingConfig,
      });
      return;
    }
    const nextConfig = normalizeZoomBandConfig(baseConfig, data.buildConfig);
    const nextPatch: Partial<ShapeEntity> = {};
    if (!isStepValueEqual(data.buildConfig, nextConfig)) {
      nextPatch.buildConfig = nextConfig;
    }
    if (!isStepValueEqual(data.processingConfig, nextProcessingConfig)) {
      nextPatch.processingConfig = nextProcessingConfig;
    }
    if (Object.keys(nextPatch).length > 0) {
      onChange({
        ...nextPatch,
      });
    }
  }, [data?.buildConfig, data?.processingConfig, onChange]);

  const handleChange = useCallback((nextConfig: ShapeBuildConfig) => {
    onChange({ buildConfig: nextConfig });
  }, [onChange]);

  return { config, handleChange };
};
