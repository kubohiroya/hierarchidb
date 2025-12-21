import { useCallback } from 'react';
import type { ProcessingConfig, TileProcessingConfig } from '../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig } from '../../common/types/index.js';

type Args = {
  config: ProcessingConfig;
  disabled?: boolean;
  onChange: (next: ProcessingConfig) => void;
};

export const useTileConfigSection = ({ config, onChange }: Args) => {
  const baseTileConfig: TileProcessingConfig | undefined = config.tileConfig ?? DEFAULT_PROCESSING_CONFIG.tileConfig;

  const update = useCallback((partial: Partial<ProcessingConfig>) => {
    onChange(mergeProcessingConfig({ ...config, ...partial }));
  }, [config, onChange]);

  if (!baseTileConfig) {
    throw new Error('TileConfigSection: baseTileConfig is not defined');
  }

  const minZoom = baseTileConfig.minZoom ?? 0;
  const maxZoom = baseTileConfig.maxZoom ?? 12;
  const zoomRange: [number, number] = minZoom <= maxZoom ? [minZoom, maxZoom] : [maxZoom, minZoom];

  return {
    baseTileConfig,
    zoomRange,
    update,
  };
};
