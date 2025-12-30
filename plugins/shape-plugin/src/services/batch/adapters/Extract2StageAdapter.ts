import type { ProgressInfo } from '../../../common/types/index.js';
import type { Extract2Task } from '../../../common/types/index.js';
import type { StageControls } from './StageControls.js';

export interface ExtractStageAdapterResult {
  processed: number;
  failed: number;
}

export interface Extract2StageAdapter {
  process(
    tasks: Extract2Task[],
    onProgress: (p: ProgressInfo) => void,
    controls?: StageControls,
  ): Promise<ExtractStageAdapterResult>;
}
