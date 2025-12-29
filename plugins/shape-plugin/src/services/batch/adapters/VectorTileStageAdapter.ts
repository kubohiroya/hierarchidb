import type { ProgressInfo } from '../../../common/types/index.js';
import type { VectorTileTask } from '../../../common/types/index.js';
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
  clearFeatureCache?(nodeId: string): void;
}
