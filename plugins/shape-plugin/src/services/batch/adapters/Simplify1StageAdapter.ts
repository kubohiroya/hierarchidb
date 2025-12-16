import type { ProgressInfo } from '../../../common/types/index.js';
import type { Simplify1Task } from '../../../common/types/index.js';
import type { StageControls } from './StageControls.js';

export interface SimplifyStageAdapterResult {
  processed: number;
  failed: number;
}

export interface Simplify1StageAdapter {
  process(
    tasks: Simplify1Task[],
    onProgress: (p: ProgressInfo) => void,
    controls?: StageControls,
  ): Promise<SimplifyStageAdapterResult>;
}
