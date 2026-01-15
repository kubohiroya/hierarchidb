import { useCallback, useId } from 'react';
import type { HybridFilterConfig } from '../../../common/types/index.js';
import { mergeBuildConfig } from '../../../common/types/index.js';
import type { ShapeBuildConfig } from '../../../common/types/index.js';

type Args = {
  config: ShapeBuildConfig;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
};

export const useTransformByBandConfigSection = ({ config, onChange }: Args) => {
  const controlId = useId();
  const baseTransformByBandConfig = config.transformByBandConfig;
  if (!baseTransformByBandConfig) {
    throw new Error('TransformByBandConfigSection: baseTransformByBandConfig is not defined');
  }
  if (!baseTransformByBandConfig.hybridFilterConfig) {
    throw new Error('TransformByBandConfigSection: hybridFilterConfig is not defined');
  }

  const baseHybridConfig: HybridFilterConfig = baseTransformByBandConfig.hybridFilterConfig;
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
    baseTransformByBandConfig,
    baseHybridConfig,
    quickRejectLogMin,
    quickRejectLogMax,
    quickRejectLogValue,
    update,
  };
};

