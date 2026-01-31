import { useCallback, useEffect, useMemo } from 'react';
import {
  resolveZoomBandSettings,
  TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES,
  loadTreeConsoleSettings,
} from '@hierarchidb/util';
import type { RouteEntity, RouteProcessingConfig } from '@hierarchidb/route-store';
import { DEFAULT_ROUTE_BUILD_CONFIG, mergeRouteBuildConfig } from '../../../common/config/buildConfig.js';

const resolveInitialBuildConfig = (dataSourceName?: string) => {
  const settings = loadTreeConsoleSettings();
  const { boundaries: zoomBandBoundaries } = resolveZoomBandSettings({
    commonBoundaries: settings.zoomBandBoundaries,
    fallbackBoundaries: TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES,
    preferCommon: true,
  });
  return {
    ...DEFAULT_ROUTE_BUILD_CONFIG,
    dataSourceName: dataSourceName ?? DEFAULT_ROUTE_BUILD_CONFIG.dataSourceName,
    transformConfig: {
      ...DEFAULT_ROUTE_BUILD_CONFIG.transformConfig,
      zoomBandBoundaries,
    },
  };
};


const resolveLegacyProcessing = (data?: Partial<RouteEntity>): RouteProcessingConfig | null => {
  if (!data) return null;
  return (data.processing ?? data.config) ?? null;
};

const resolveBoundariesFromLegacy = (legacy: RouteProcessingConfig | null, fallback: number[]): number[] => {
  const minZoom = legacy?.vectorTiles?.minZoom;
  const maxZoom = legacy?.vectorTiles?.maxZoom;
  if (Number.isFinite(minZoom) && Number.isFinite(maxZoom)) {
    const min = Number(minZoom);
    const max = Number(maxZoom);
    return min <= max ? [min, max] : [max, min];
  }
  return fallback;
};

const mergeLegacyIntoBuildConfig = (baseConfig: ReturnType<typeof resolveInitialBuildConfig>, legacy: RouteProcessingConfig | null) => {
  if (!legacy) return baseConfig;
  const zoomBandBoundaries = resolveBoundariesFromLegacy(legacy, baseConfig.transformConfig.zoomBandBoundaries);
  const tolerance = legacy.extraction?.tolerance;
  const bufferSize = legacy.vectorTiles?.buffer;
  return mergeRouteBuildConfig(baseConfig, {
    transformConfig: {
      ...baseConfig.transformConfig,
      zoomBandBoundaries,
      tolerance: Number.isFinite(tolerance) ? Number(tolerance) : baseConfig.transformConfig.tolerance,
    },
    vtConfig: {
      ...baseConfig.vtConfig,
      bufferSize: Number.isFinite(bufferSize) ? Number(bufferSize) : baseConfig.vtConfig.bufferSize,
    },
  });
};

type Args = {
  data: Partial<RouteEntity>;
  onChange: (patch: Partial<RouteEntity>) => void;
};

export const useRouteBuildConfigStep = ({ data, onChange }: Args) => {
  const config = useMemo(() => {
    const baseConfig = resolveInitialBuildConfig(data?.dataSourceName);
    if (data?.buildConfig) return mergeRouteBuildConfig(baseConfig, data.buildConfig);
    const legacy = resolveLegacyProcessing(data);
    return mergeLegacyIntoBuildConfig(baseConfig, legacy);
  }, [data?.buildConfig, data?.dataSourceName, data?.config, data?.processing]);

  useEffect(() => {
    const baseConfig = resolveInitialBuildConfig(data?.dataSourceName);
    if (!data?.buildConfig) {
      const legacy = resolveLegacyProcessing(data);
      const merged = mergeLegacyIntoBuildConfig(baseConfig, legacy);
      onChange({ buildConfig: merged });
      return;
    }
    const coefficient = data.buildConfig.transformConfig?.excludePolygonAreaCoefficient;
    if (!Number.isFinite(coefficient)) {
      onChange({ buildConfig: mergeRouteBuildConfig(baseConfig, data.buildConfig) });
      return;
    }
    if (data?.dataSourceName && data.buildConfig.dataSourceName !== data.dataSourceName) {
      onChange({
        buildConfig: {
          ...data.buildConfig,
          dataSourceName: data.dataSourceName,
        },
      });
    }
  }, [data?.buildConfig, data?.dataSourceName, data?.config, data?.processing, onChange]);

  const handleChange = useCallback((nextConfig: typeof config) => {
    onChange({ buildConfig: nextConfig });
  }, [onChange]);

  return { config, handleChange };
};
