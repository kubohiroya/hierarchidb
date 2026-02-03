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
import { DEFAULT_BUILD_CONFIG, mergeBuildConfig } from '../../../common/types/index.js';
import type { ShapeEntity } from '../../../common/types/index.js';
import type { ShapeBuildConfig } from '../../../common/types/index.js';

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
    transformConfig: {
      ...DEFAULT_BUILD_CONFIG.transformConfig,
      zoomBandBoundaries,
    },
  };
};

const normalizeZoomBandConfig = (
  baseConfig: ShapeBuildConfig,
  overrides?: Partial<ShapeBuildConfig>,
): ShapeBuildConfig => {
  const merged = overrides ? mergeBuildConfig(baseConfig, overrides) : baseConfig;
  const rawBoundaries = merged.transformConfig.zoomBandBoundaries;
  const normalizedBoundaries = normalizeZoomBandBoundaries(
    Array.isArray(rawBoundaries) ? rawBoundaries : baseConfig.transformConfig.zoomBandBoundaries,
    ZOOM_BAND_MIN_ZOOM,
    ZOOM_BAND_MAX_ZOOM,
    ZOOM_BAND_MAX_RANGES,
  );
  if (areZoomBandBoundariesEqual(rawBoundaries, normalizedBoundaries)) {
    return merged;
  }
  return {
    ...merged,
    transformConfig: {
      ...merged.transformConfig,
      zoomBandBoundaries: normalizedBoundaries,
    },
  };
};

export const useShapeBuildConfigStep = ({ data, onChange }: Args) => {
  const config = useMemo(() => {
    const baseConfig = resolveInitialBuildConfig();
    return normalizeZoomBandConfig(baseConfig, data?.buildConfig);
  }, [data?.buildConfig]);

  useEffect(() => {
    const baseConfig = resolveInitialBuildConfig();
    if (!data?.buildConfig) {
      onChange({ buildConfig: baseConfig });
      return;
    }
    const nextConfig = normalizeZoomBandConfig(baseConfig, data.buildConfig);
    const coefficient = data.buildConfig.transformConfig?.excludePolygonAreaCoefficient;
    const rawBoundaries = data.buildConfig.transformConfig?.zoomBandBoundaries;
    const normalizedBoundaries = nextConfig.transformConfig.zoomBandBoundaries;
    const boundariesChanged = !areZoomBandBoundariesEqual(rawBoundaries, normalizedBoundaries);
    if (!Number.isFinite(coefficient)) {
      onChange({ buildConfig: nextConfig });
      return;
    }
    if (boundariesChanged) {
      onChange({ buildConfig: nextConfig });
    }
  }, [data?.buildConfig, onChange]);

  const handleChange = useCallback((nextConfig: ShapeBuildConfig) => {
    onChange({ buildConfig: nextConfig });
  }, [onChange]);

  return { config, handleChange };
};
