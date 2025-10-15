import type { ProgressInfo } from '../../../common/shared/index.js';
import type { VectorTileTask } from '../../common/types.js';
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
