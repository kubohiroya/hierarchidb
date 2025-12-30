import type { ProgressInfo } from '../../../common/types/index.js';
import type { Extract1Task } from '../../../common/types/index.js';
import type { StageControls } from './StageControls.js';

export interface ExtractStageAdapterResult {
  processed: number;
  failed: number;
  skipped?: number;
}

export interface Extract1StageAdapter {
  process(
    tasks: Extract1Task[],
    onProgress: (p: ProgressInfo) => void,
    controls?: StageControls,
  ): Promise<ExtractStageAdapterResult>;
}
