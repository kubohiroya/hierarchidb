import { useCallback } from 'react';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import { mergeBuildConfig } from '../../../common/types/index.js';
//import { VTConfig } from '@hierarchidb/shape-store/ShapeDB.js';

type Args = {
  buildConfig: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig) => void;
};

export const useVTConfigSection = ({ buildConfig, onChange }: Args) => {
  const update = useCallback((partial: Partial<ShapeBuildConfig>) => {
    onChange(mergeBuildConfig(buildConfig, partial));
  }, [buildConfig, onChange]);

  return {
    buildConfig,
    update,
  };
};
