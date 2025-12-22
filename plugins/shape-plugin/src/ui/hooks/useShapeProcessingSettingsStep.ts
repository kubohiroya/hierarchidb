import { useCallback, useMemo } from 'react';
import { DEFAULT_PROCESSING_CONFIG, mergeBatchConfig } from '../../common/types/index.js';
import type { BatchConfig, ShapeEntity } from '../../common/types/index.js';
import { clearStagesIfPresent, resolveBatchConfigInvalidation, resolveShapeSessionId } from '../utils/sessionInvalidation.js';

type Args = {
  data: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
};

export const useShapeProcessingSettingsStep = ({ data, onChange }: Args) => {
  const config = useMemo(
    () => mergeBatchConfig(data?.batchConfig ?? DEFAULT_PROCESSING_CONFIG),
    [data?.batchConfig],
  );

  const handleChange = useCallback((nextConfig: BatchConfig) => {
    const previousConfig = mergeBatchConfig(data?.batchConfig ?? DEFAULT_PROCESSING_CONFIG);
    const nextMerged = mergeBatchConfig(nextConfig ?? DEFAULT_PROCESSING_CONFIG);
    const stages = resolveBatchConfigInvalidation(previousConfig, nextMerged);
    const sessionId = resolveShapeSessionId(data);
    if (sessionId && stages.length > 0) {
      void clearStagesIfPresent(sessionId, stages);
    }
    onChange({ batchConfig: nextMerged });
  }, [data, onChange]);

  return { config, handleChange };
};
