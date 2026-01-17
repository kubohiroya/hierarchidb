import { useCallback, useId } from 'react';
import type { HybridFilterConfig } from '../../../common/types/index.js';
import { mergeBuildConfig } from '../../../common/types/index.js';
import type { ShapeBuildConfig } from '../../../common/types/index.js';

type Args = {
  config: ShapeBuildConfig;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
};

export const useTransformConfigSection = ({ config, onChange }: Args) => {
  const controlId = useId();
  const baseTransformConfig = config.transformConfig;
  if (!baseTransformConfig) {
    throw new Error('TransformConfigSection: baseTransformConfig is not defined');
  }
  if (!baseTransformConfig.hybridFilterConfig) {
    throw new Error('TransformConfigSection: hybridFilterConfig is not defined');
  }
  if (!baseTransformConfig.preSimplifyFilterConfig) {
    throw new Error('TransformConfigSection: preSimplifyFilterConfig is not defined');
  }

  const baseHybridConfig: HybridFilterConfig = baseTransformConfig.hybridFilterConfig;
  const quickRejectMin = 0.001;
  const quickRejectMax = 1;
  const quickRejectValue = Math.min(
    Math.max(baseHybridConfig.quickRejectThreshold ?? 0.1, quickRejectMin),
    quickRejectMax,
  );
  const quickRejectLogMin = Math.log10(quickRejectMin);
  const quickRejectLogMax = Math.log10(quickRejectMax);
  const quickRejectLogValue = Math.log10(quickRejectValue);

  const update = useCallback((partial: Partial<ShapeBuildConfig>) => {
    onChange(mergeBuildConfig(config, partial));
  }, [config, onChange]);

  return {
    controlId,
    baseTransformConfig,
    baseHybridConfig,
    quickRejectLogMin,
    quickRejectLogMax,
    quickRejectLogValue,
    update,
  };
};
