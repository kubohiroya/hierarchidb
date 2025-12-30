import { useCallback, useMemo } from 'react';
import { useId } from 'react';
import type { BatchConfig, HybridFilterConfig } from '../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeBatchConfig } from '../../common/types/index.js';

type Args = {
  config: BatchConfig;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
};

export const useExtract1ConfigSection = ({ config, onChange }: Args) => {
  const controlId = useId();
  const baseExtract1Config = config.extract1Config ?? DEFAULT_PROCESSING_CONFIG.extract1Config;
  const defaultHybridConfig: HybridFilterConfig =
    DEFAULT_PROCESSING_CONFIG.extract1Config?.hybridFilterConfig ?? {
      quickRejectThreshold: 0.1,
      regularShapeMinRatio: 0.5,
      regularShapeMaxRatio: 2.0,
      simpleShapeVertexThreshold: 10,
      elongatedShapeCorrectionFactor: 0.8,
    };

  if (!baseExtract1Config) {
    throw new Error('Extract1ConfigSection: baseExtract1Config is not defined');
  }

  const baseHybridConfig: HybridFilterConfig = baseExtract1Config.hybridFilterConfig ?? defaultHybridConfig;
  const quickRejectMin = 0.001;
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
    baseExtract1Config,
    baseHybridConfig,
    quickRejectLogMin,
    quickRejectLogMax,
    quickRejectLogValue,
    update,
  };
};

export const useExtract2ConfigSection = ({ config, onChange }: Args) => {
  const baseExtract2Config = config.extract2Config ?? DEFAULT_PROCESSING_CONFIG.extract2Config;
  if (!baseExtract2Config) {
    throw new Error('Extract2ConfigSection: baseExtract2Config is not defined');
  }

  const quantizeOptions = [1000, 5000, 10000, 20000, 50000, 100000, 200000];
  const resolveQuantizeIndex = (value: number) => {
    const resolved = quantizeOptions.reduce((best, option, index) => {
      const diff = Math.abs(option - value);
      if (!best || diff < best.diff) return { index, diff };
      return best;
    }, null as null | { index: number; diff: number });
    return resolved?.index ?? 0;
  };
  const quantizeValue = baseExtract2Config.quantize ?? 50000;
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
    baseExtract2Config,
    quantizeOptions,
    quantizeIndex,
    quantizeRank,
    quantizeLabel,
    update,
  };
};
