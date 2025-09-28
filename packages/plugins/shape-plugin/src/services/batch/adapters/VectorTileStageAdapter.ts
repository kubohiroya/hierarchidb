import type { ProgressInfo } from '../../../shared/index.js';
import type { VectorTileTask } from '../../types.js';
import type { StageControls } from './StageControls.js';

export interface VectorTileStageAdapterResult {
  processed: number;
  failed: number;
}

export interface VectorTileStageAdapter {
  process(
    tasks: VectorTileTask[],
    onProgress: (p: ProgressInfo) => void,
    controls?: StageControls,
  ): Promise<VectorTileStageAdapterResult>;
}
