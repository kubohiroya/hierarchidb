import { useCallback } from 'react';
import type { ShapeBuildConfig, ShapeBuildConfigPatch } from '~/common/types/BuildTaskResult';
import { applyBuildConfigPatch } from '~/services/utils/shapeBuildUtils';

type Args = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
};

export const useGeometryConfigSection = ({ config, onChange }: Args) => {
  const baseGeometryConfig = config.geometryConfig;
  if (!baseGeometryConfig) {
    throw new Error('GeometryConfigSection: baseGeometryConfig is not defined');
  }
  if (!baseGeometryConfig.hybridFilterConfig) {
    throw new Error('GeometryConfigSection: hybridFilterConfig is not defined');
  }
  if (!baseGeometryConfig.omitDetailsConfig) {
    throw new Error('GeometryConfigSection: omitDetailsConfig is not defined');
  }

  const update = useCallback(
    (partial: ShapeBuildConfigPatch) => {
      onChange((prevConfig) => applyBuildConfigPatch(prevConfig, partial));
    },
    [onChange]
  );

  return {
    baseGeometryConfig,
    update,
  };
};
