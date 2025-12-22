import { useCallback } from 'react';
import type { BatchConfig, TileBatchConfig } from '../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeBatchConfig } from '../../common/types/index.js';

type Args = {
  config: BatchConfig;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
};

export const useTileConfigSection = ({ config, onChange }: Args) => {
  const baseTileConfig: TileBatchConfig | undefined = config.tileConfig ?? DEFAULT_PROCESSING_CONFIG.tileConfig;

  const update = useCallback((partial: Partial<BatchConfig>) => {
    onChange(mergeBatchConfig({ ...config, ...partial }));
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
