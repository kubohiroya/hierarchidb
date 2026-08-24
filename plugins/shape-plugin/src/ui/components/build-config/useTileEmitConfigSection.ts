import { useCallback } from 'react';
import type { ShapeBuildConfig, ShapeBuildConfigPatch } from '~/common/types/BuildTaskResult';
import { applyBuildConfigPatch } from '~/services/utils/shapeBuildUtils';

//import { TileEmitConfig } from '@hierarchidb/shape-store/ShapeDB.js';

type Args = {
  buildConfig: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
};

export const useTileEmitConfigSection = ({ buildConfig, onChange }: Args) => {
  const update = useCallback(
    (partial: ShapeBuildConfigPatch) => {
      onChange((prevConfig) => applyBuildConfigPatch(prevConfig, partial));
    },
    [onChange]
  );

  return {
    buildConfig,
    update,
  };
};
