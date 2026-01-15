import { useCallback, useEffect, useMemo } from 'react';
import { DEFAULT_BUILD_CONFIG } from '../../../common/types/index.js';
import type { ShapeEntity } from '../../../common/types/index.js';
import type { ShapeBuildConfig } from '../../../common/types/index.js';

type Args = {
  data: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
};

export const useShapeBuildConfigStep = ({ data, onChange }: Args) => {
  const config = useMemo(
    () => data?.buildConfig ?? DEFAULT_BUILD_CONFIG,
    [data?.buildConfig],
  );

  useEffect(() => {
    if (data?.buildConfig) return;
    onChange({ buildConfig: DEFAULT_BUILD_CONFIG });
  }, [data?.buildConfig, onChange]);

  const handleChange = useCallback((nextConfig: ShapeBuildConfig) => {
    onChange({ buildConfig: nextConfig });
  }, [onChange]);

  return { config, handleChange };
};
