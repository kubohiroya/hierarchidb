import { useCallback, useId } from 'react';
import type { HybridFilterConfig } from '../../../common/types/index.js';
import { DEFAULT_BUILD_CONFIG, mergeBuildConfig } from '../../../common/types/index.js';
import type { ShapeBuildConfig } from '../../../common/types/index.js';

type Args = {
  config: ShapeBuildConfig;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
};

export const useTransformByBandConfigSection = ({ config, onChange }: Args) => {
  const controlId = useId();
  const baseTransformByBandConfig = config.transformByBandConfig ?? DEFAULT_BUILD_CONFIG.transformByBandConfig;
  const defaultHybridConfig: HybridFilterConfig =
    DEFAULT_BUILD_CONFIG.transformByBandConfig?.hybridFilterConfig ?? {
      quickRejectThreshold: 0.1,
      regularShapeMinRatio: 0.5,
      regularShapeMaxRatio: 2.0,
      simpleShapeVertexThreshold: 10,
      elongatedShapeCorrectionFactor: 0.8,
    };

  if (!baseTransformByBandConfig) {
    throw new Error('TransformByBandConfigSection: baseTransformByBandConfig is not defined');
  }

  const baseHybridConfig: HybridFilterConfig = baseTransformByBandConfig.hybridFilterConfig ?? defaultHybridConfig;
  const quickRejectMin = 0.001;
  const quickRejectMax = 1;
  const quickRejectValue = Math.min(
    Math.max(baseHybridConfig?.quickRejectThreshold ?? 0.1, quickRejectMin),
    quickRejectMax,
  );
  const quickRejectLogMin = Math.log10(quickRejectMin);
  const quickRejectLogMax = Math.log10(quickRejectMax);
  const quickRejectLogValue = Math.log10(quickRejectValue);

  const update = useCallback((partial: Partial<ShapeBuildConfig>) => {
    onChange(mergeBuildConfig({ ...config, ...partial }));
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

