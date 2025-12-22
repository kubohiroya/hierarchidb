import { useCallback, useMemo } from 'react';
import { useId } from 'react';
import type { BatchConfig, SimplificationBatchConfig, HybridFilterConfig } from '../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeBatchConfig } from '../../common/types/index.js';

type Args = {
  config: BatchConfig;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
};

export const useSimplificationConfigSection = ({ config, onChange }: Args) => {
  const controlId = useId();
  const baseSimplificationConfig: SimplificationBatchConfig | undefined =
    config.simplificationConfig ?? DEFAULT_PROCESSING_CONFIG.simplificationConfig;
  const defaultHybridConfig: HybridFilterConfig =
    DEFAULT_PROCESSING_CONFIG.simplificationConfig?.hybridFilterConfig ?? {
      quickRejectThreshold: 0.1,
      regularShapeMinRatio: 0.5,
      regularShapeMaxRatio: 2.0,
      simpleShapeVertexThreshold: 50,
      elongatedShapeCorrectionFactor: 0.8,
    };

  if (!baseSimplificationConfig) {
    throw new Error('SimplificationConfigSection: baseSimplificationConfig is not defined');
  }

  const baseHybridConfig: HybridFilterConfig = baseSimplificationConfig.hybridFilterConfig ?? defaultHybridConfig;
  const quickRejectMin = 0.01;
  const quickRejectMax = 1;
  const quickRejectValue = Math.min(
    Math.max(baseHybridConfig?.quickRejectThreshold ?? 0.1, quickRejectMin),
    quickRejectMax,
  );
  const quickRejectLogMin = Math.log10(quickRejectMin);
  const quickRejectLogMax = Math.log10(quickRejectMax);
  const quickRejectLogValue = Math.log10(quickRejectValue);
  const quantizeOptions = [100, 300, 1000, 3000, 10000];
  const resolveQuantizeIndex = (value: number) => {
    const resolved = quantizeOptions.reduce((best, option, index) => {
      const diff = Math.abs(option - value);
      if (!best || diff < best.diff) return { index, diff };
      return best;
    }, null as null | { index: number; diff: number });
    return resolved?.index ?? 0;
  };
  const quantizeValue = baseSimplificationConfig.quantize ?? 10000;
  const quantizeIndex = resolveQuantizeIndex(quantizeValue);
  const quantizeRank = quantizeIndex + 1;

  const update = useCallback((partial: Partial<BatchConfig>) => {
    onChange(mergeBatchConfig({ ...config, ...partial }));
  }, [config, onChange]);

  const quantizeLabel = useMemo(
    () => quantizeOptions[quantizeIndex]?.toLocaleString() ?? '',
    [quantizeIndex, quantizeOptions],
  );

  return {
    controlId,
    baseSimplificationConfig,
    baseHybridConfig,
    quickRejectLogMin,
    quickRejectLogMax,
    quickRejectLogValue,
    quantizeOptions,
    quantizeIndex,
    quantizeRank,
    quantizeLabel,
    update,
  };
};
