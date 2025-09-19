import type { ProgressInfo } from '../../../shared/index.js';
import type { Simplify2Task } from '../../types.js';

export interface SimplifyStageAdapterResult {
  processed: number;
  failed: number;
}

export interface Simplify2StageAdapter {
  process(tasks: Simplify2Task[], onProgress: (p: ProgressInfo) => void): Promise<SimplifyStageAdapterResult>;
}

