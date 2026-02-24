import { useCallback, useEffect, useRef } from 'react';
import type { ShapeBuildConfig } from '~/common/types/index';
import { mergeBuildConfig } from '~/common/types/index';
//import { VTConfig } from '@hierarchidb/shape-store/ShapeDB.js';

type Args = {
  buildConfig: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig) => void;
};

export const useVTConfigSection = ({ buildConfig, onChange }: Args) => {
  const latestConfigRef = useRef(buildConfig);
  useEffect(() => {
    latestConfigRef.current = buildConfig;
  }, [buildConfig]);
  const update = useCallback((partial: Partial<ShapeBuildConfig>) => {
    onChange(mergeBuildConfig(latestConfigRef.current, partial));
  }, [onChange]);

  return {
    buildConfig,
    update,
  };
};
