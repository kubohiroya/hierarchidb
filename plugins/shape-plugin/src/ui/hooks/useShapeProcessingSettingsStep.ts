import { useCallback, useMemo } from 'react';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig } from '../../common/types/index.js';
import type { ProcessingConfig, ShapeEntity } from '../../common/types/index.js';
import { clearStagesIfPresent, resolveProcessingConfigInvalidation, resolveShapeSessionId } from '../utils/sessionInvalidation.js';

type Args = {
  data: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
};

export const useShapeProcessingSettingsStep = ({ data, onChange }: Args) => {
  const config = useMemo(
    () => mergeProcessingConfig(data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG),
    [data?.processingConfig],
  );

  const handleChange = useCallback((nextConfig: ProcessingConfig) => {
    const previousConfig = mergeProcessingConfig(data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG);
    const nextMerged = mergeProcessingConfig(nextConfig ?? DEFAULT_PROCESSING_CONFIG);
    const stages = resolveProcessingConfigInvalidation(previousConfig, nextMerged);
    const sessionId = resolveShapeSessionId(data);
    if (sessionId && stages.length > 0) {
      void clearStagesIfPresent(sessionId, stages);
    }
    onChange({ processingConfig: nextMerged });
  }, [data, onChange]);

  return { config, handleChange };
};
