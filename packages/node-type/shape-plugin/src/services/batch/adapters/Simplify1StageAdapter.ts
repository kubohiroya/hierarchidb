import type { ProgressInfo } from '../../../shared';
import type { Simplify1Task } from '../../types';

export interface SimplifyStageAdapterResult {
  processed: number;
  failed: number;
}

export interface Simplify1StageAdapter {
  process(tasks: Simplify1Task[], onProgress: (p: ProgressInfo) => void): Promise<SimplifyStageAdapterResult>;
}

