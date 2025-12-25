import { useCallback, useMemo } from 'react';
import { useId } from 'react';
import type { BatchConfig, HybridFilterConfig } from '../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeBatchConfig } from '../../common/types/index.js';

type Args = {
  config: BatchConfig;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
};

export const useSimplify1ConfigSection = ({ config, onChange }: Args) => {
  const controlId = useId();
  const baseSimplify1Config = config.simplify1Config ?? DEFAULT_PROCESSING_CONFIG.simplify1Config;
  const defaultHybridConfig: HybridFilterConfig =
    DEFAULT_PROCESSING_CONFIG.simplify1Config?.hybridFilterConfig ?? {
      quickRejectThreshold: 0.1,
      regularShapeMinRatio: 0.5,
      regularShapeMaxRatio: 2.0,
      simpleShapeVertexThreshold: 50,
      elongatedShapeCorrectionFactor: 0.8,
    };

  if (!baseSimplify1Config) {
    throw new Error('Simplify1ConfigSection: baseSimplify1Config is not defined');
  }

  const baseHybridConfig: HybridFilterConfig = baseSimplify1Config.hybridFilterConfig ?? defaultHybridConfig;
  const quickRejectMin = 0.01;
  const quickRejectMax = 1;
  const quickRejectValue = Math.min(
    Math.max(baseHybridConfig?.quickRejectThreshold ?? 0.1, quickRejectMin),
    quickRejectMax,
  );
  const quickRejectLogMin = Math.log10(quickRejectMin);
  const quickRejectLogMax = Math.log10(quickRejectMax);
  const quickRejectLogValue = Math.log10(quickRejectValue);

  const update = useCallback((partial: Partial<BatchConfig>) => {
    onChange(mergeBatchConfig({ ...config, ...partial }));
  }, [config, onChange]);

  return {
    controlId,
    baseSimplify1Config,
    baseHybridConfig,
    quickRejectLogMin,
    quickRejectLogMax,
    quickRejectLogValue,
    update,
  };
};

export const useSimplify2ConfigSection = ({ config, onChange }: Args) => {
  const baseSimplify2Config = config.simplify2Config ?? DEFAULT_PROCESSING_CONFIG.simplify2Config;
  if (!baseSimplify2Config) {
    throw new Error('Simplify2ConfigSection: baseSimplify2Config is not defined');
  }

  const quantizeOptions = [100, 300, 1000, 3000, 10000];
  const resolveQuantizeIndex = (value: number) => {
    const resolved = quantizeOptions.reduce((best, option, index) => {
      const diff = Math.abs(option - value);
      if (!best || diff < best.diff) return { index, diff };
      return best;
    }, null as null | { index: number; diff: number });
    return resolved?.index ?? 0;
  };
  const quantizeValue = baseSimplify2Config.quantize ?? 10000;
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
    baseSimplify2Config,
    quantizeOptions,
    quantizeIndex,
    quantizeRank,
    quantizeLabel,
    update,
  };
};
