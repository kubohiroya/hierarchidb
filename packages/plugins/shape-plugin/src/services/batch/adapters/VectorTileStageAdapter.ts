import type { ProgressInfo } from '../../../shared/index.js';
import type { VectorTileTask } from '../../types.js';

export interface VectorTileStageAdapterResult {
  processed: number;
  failed: number;
}

export interface VectorTileStageAdapter {
  process(tasks: VectorTileTask[], onProgress: (p: ProgressInfo) => void): Promise<VectorTileStageAdapterResult>;
}

