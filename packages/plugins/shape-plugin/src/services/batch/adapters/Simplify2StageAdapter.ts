import type { ProgressInfo } from '../../../shared/index.js';
import type { Simplify2Task } from '../../types.js';
import type { StageControls } from './StageControls.js';

export interface SimplifyStageAdapterResult {
  processed: number;
  failed: number;
}

export interface Simplify2StageAdapter {
  process(
    tasks: Simplify2Task[],
    onProgress: (p: ProgressInfo) => void,
    controls?: StageControls,
  ): Promise<SimplifyStageAdapterResult>;
}
