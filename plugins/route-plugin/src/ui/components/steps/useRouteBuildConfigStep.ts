import { useCallback, useEffect, useMemo } from 'react';
import {
  resolveZoomBandSettings,
  TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES,
  loadTreeConsoleSettings,
} from '@hierarchidb/util';
import type { RouteEntity } from '@hierarchidb/route-api';
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

type Args = {
  data: Partial<RouteEntity>;
  onChange: (patch: Partial<RouteEntity>) => void;
};

export const useRouteBuildConfigStep = ({ data, onChange }: Args) => {
  const config = useMemo(() => {
    const baseConfig = resolveInitialBuildConfig(data?.dataSourceName);
    return data?.buildConfig ? mergeRouteBuildConfig(baseConfig, data.buildConfig) : baseConfig;
  }, [data?.buildConfig, data?.dataSourceName]);

  useEffect(() => {
    const baseConfig = resolveInitialBuildConfig(data?.dataSourceName);
    if (!data?.buildConfig) {
      onChange({ buildConfig: baseConfig });
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
  }, [data?.buildConfig, data?.dataSourceName, onChange]);

  const handleChange = useCallback((nextConfig: typeof config) => {
    onChange({ buildConfig: nextConfig });
  }, [onChange]);

  return { config, handleChange };
};
