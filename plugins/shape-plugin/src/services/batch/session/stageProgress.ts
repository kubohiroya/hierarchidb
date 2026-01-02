import type { ProgressInfo } from '../../../common/types/index.js';

export type StageProgressBaseCounts = {
  total: number;
  baseCompleted: number;
  baseFailed: number;
};

export function computeBaseCounts(params: {
  total: number;
  completedCount: number;
  failedCount: number;
}): StageProgressBaseCounts {
  const { total, completedCount, failedCount } = params;
  const baseCompleted = Math.min(Math.max(0, completedCount), total);
  const baseFailed = Math.min(Math.max(0, failedCount), Math.max(0, total - baseCompleted));
  return { total, baseCompleted, baseFailed };
}

export function computePercentage(params: {
  total: number;
  completed: number;
  failed: number;
  skipped?: number;
}): number {
  const { total, completed, failed, skipped = 0 } = params;
  const done = Math.min(total, Math.max(0, completed) + Math.max(0, failed) + Math.max(0, skipped));
  return total > 0 ? (done / total) * 100 : 0;
}

export function buildStageProgressReporter(params: {
  base: StageProgressBaseCounts;
  stage: ProgressInfo['currentStage'];
  progressCallback?: (progress: ProgressInfo) => void;
}): (p: ProgressInfo) => void {
  const { base, stage, progressCallback } = params;

  return (p: ProgressInfo) => {
    const completed = Math.min(base.total, base.baseCompleted + p.completed);
    const failed = Math.min(base.total - completed, base.baseFailed + p.failed);
    const skipped = p.skipped ?? 0;
    const percentage = computePercentage({
      total: base.total,
      completed,
      failed,
      skipped,
    });

    progressCallback?.({
      ...p,
      total: base.total,
      completed,
      failed,
      skipped,
      percentage,
      currentStage: stage,
    });
  };
}

