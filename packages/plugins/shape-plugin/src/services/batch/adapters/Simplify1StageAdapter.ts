import type { ProgressInfo } from '../../../shared/index.js';
import type { Simplify1Task } from '../../types.js';
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
