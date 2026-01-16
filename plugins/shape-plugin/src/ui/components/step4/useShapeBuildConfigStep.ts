import { useCallback, useEffect, useMemo } from 'react';
import { TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES, loadTreeConsoleSettings } from '@hierarchidb/util';
import { DEFAULT_BUILD_CONFIG } from '../../../common/types/index.js';
import type { ShapeEntity } from '../../../common/types/index.js';
import type { ShapeBuildConfig } from '../../../common/types/index.js';

type Args = {
  data: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
};


const resolveInitialBuildConfig = (): ShapeBuildConfig => {
  const settings = loadTreeConsoleSettings();
  const zoomBandBoundaries = Array.isArray(settings.zoomBandBoundaries)
    ? settings.zoomBandBoundaries
    : TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES;
  return {
    ...DEFAULT_BUILD_CONFIG,
    transformConfig: {
      ...DEFAULT_BUILD_CONFIG.transformConfig,
      zoomBandBoundaries,
    },
  };
};

export const useShapeBuildConfigStep = ({ data, onChange }: Args) => {
  const config = useMemo(
    () => data?.buildConfig ?? resolveInitialBuildConfig(),
    [data?.buildConfig],
  );

  useEffect(() => {
    if (data?.buildConfig) return;
    onChange({ buildConfig: resolveInitialBuildConfig() });
  }, [data?.buildConfig, onChange]);

  const handleChange = useCallback((nextConfig: ShapeBuildConfig) => {
    onChange({ buildConfig: nextConfig });
  }, [onChange]);

  return { config, handleChange };
};
