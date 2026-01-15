import { useCallback, useMemo } from 'react';
import { mergeBuildConfig } from '../../../services/utils/utils.ts';
import type { ShapeBuildConfig } from '../../../common/types/index.js';

type Args = {
  config: ShapeBuildConfig;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
};

export const useTransformByZoomConfigSection = ({ config, onChange }: Args) => {
  const baseTransformByZoomConfig = config.transformByZoomConfig;
  if (!baseTransformByZoomConfig) {
    throw new Error('TransformByZoomConfigSection: baseTransformByZoomConfig is not defined');
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
  const quantizeValue = baseTransformByZoomConfig.quantize;
  const quantizeIndex = resolveQuantizeIndex(quantizeValue);
  const quantizeRank = quantizeIndex + 1;

  const update = useCallback((partial: Partial<ShapeBuildConfig>) => {
    onChange(mergeBuildConfig(config, partial));
  }, [config, onChange]);

  const quantizeLabel = useMemo(
    () => quantizeOptions[quantizeIndex]?.toLocaleString() ?? '',
    [quantizeIndex],
  );

  return {
    baseTransformByZoomConfig,
    quantizeOptions,
    quantizeIndex,
    quantizeRank,
    quantizeLabel,
    update,
  };
};
