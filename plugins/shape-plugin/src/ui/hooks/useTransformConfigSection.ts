import { useCallback } from 'react';
import { applyBuildConfigPatch } from '~/common/types/index';
import type { ShapeBuildConfig, ShapeBuildConfigPatch } from '~/common/types/index';

type Args = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
};

export const useTransformConfigSection = ({ config, onChange }: Args) => {
  const baseTransformConfig = config.transformConfig;
  if (!baseTransformConfig) {
    throw new Error('TransformConfigSection: baseTransformConfig is not defined');
  }
  if (!baseTransformConfig.hybridFilterConfig) {
    throw new Error('TransformConfigSection: hybridFilterConfig is not defined');
  }
  if (!baseTransformConfig.omitDetailsConfig) {
    throw new Error('TransformConfigSection: omitDetailsConfig is not defined');
  }

  const update = useCallback((partial: ShapeBuildConfigPatch) => {
    onChange((prevConfig) => applyBuildConfigPatch(prevConfig, partial));
  }, [onChange]);

  return {
    baseTransformConfig,
    update,
  };
};
