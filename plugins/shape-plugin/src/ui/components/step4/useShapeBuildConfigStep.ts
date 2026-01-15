import { useCallback, useEffect, useMemo } from 'react';
import { DEFAULT_BUILD_CONFIG, mergeBuildConfig } from '../../../common/types/index.js';
import type { ShapeEntity } from '../../../common/types/index.js';
import type { ShapeBuildConfig } from '../../../common/types/index.js';

type Args = {
  data: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
};

export const useShapeBuildConfigStep = ({ data, onChange }: Args) => {
  const config = useMemo(
    () => mergeBuildConfig(data?.buildConfig ?? DEFAULT_BUILD_CONFIG),
    [data?.buildConfig],
  );

  useEffect(() => {
    if (!data?.buildConfig) return;
    //if (data.buildConfig.cleanupConfig) return;
    onChange({ buildConfig: mergeBuildConfig(data.buildConfig) });
  }, [data?.buildConfig, onChange]);

  const handleChange = useCallback((nextConfig: ShapeBuildConfig) => {
    const nextMerged = mergeBuildConfig(nextConfig ?? DEFAULT_BUILD_CONFIG);
    onChange({ buildConfig: nextMerged });
  }, [onChange]);

  return { config, handleChange };
};
