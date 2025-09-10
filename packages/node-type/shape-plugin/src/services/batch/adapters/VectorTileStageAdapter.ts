import type { ProgressInfo } from '../../../shared';
import type { VectorTileTask } from '../../types';

export interface VectorTileStageAdapterResult {
  processed: number;
  failed: number;
}

export interface VectorTileStageAdapter {
  process(tasks: VectorTileTask[], onProgress: (p: ProgressInfo) => void): Promise<VectorTileStageAdapterResult>;
}

