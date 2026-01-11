import { useCallback, useEffect, useMemo } from 'react';
import { DEFAULT_PROCESSING_CONFIG, mergeBatchConfig } from '../../../common/types/index.js';
import type { BatchConfig, ShapeEntity } from '../../../common/types/index.js';

type Args = {
  data: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
};

export const useShapeBuildConfigStep = ({ data, onChange }: Args) => {
  const config = useMemo(
    () => mergeBatchConfig(data?.batchConfig ?? DEFAULT_PROCESSING_CONFIG),
    [data?.batchConfig],
  );

  useEffect(() => {
    if (!data?.batchConfig) return;
    if (data.batchConfig.cleanupConfig) return;
    onChange({ batchConfig: mergeBatchConfig(data.batchConfig) });
  }, [data?.batchConfig, onChange]);

  const handleChange = useCallback((nextConfig: BatchConfig) => {
    const nextMerged = mergeBatchConfig(nextConfig ?? DEFAULT_PROCESSING_CONFIG);
    onChange({ batchConfig: nextMerged });
  }, [onChange]);

  return { config, handleChange };
};
