import type { ProgressInfo, ProcessingStage } from '../../../../common/types/index.js';
import type { SessionTaskRegistry } from '../../SessionTaskRegistry.js';
import { computePercentage } from './stageProgress.js';
import type { StageSummary } from './stageSummary.js';
import { summarizeStageRecords } from './stageSummary.js';

export function buildStageSummaryProgressInfo(params: {
  stage: ProcessingStage;
  summary: StageSummary;
  currentTask: string;
}): ProgressInfo {
  const { stage, summary, currentTask } = params;
  return {
    total: summary.total,
    completed: summary.completed,
    failed: summary.failed,
    skipped: summary.skipped,
    percentage: computePercentage({
      total: summary.total,
      completed: summary.completed,
      failed: summary.failed,
      skipped: summary.skipped,
    }),
    currentStage: stage,
    currentTask,
  };
}

/**
 * listStageRecords → summary → progressCallback をまとめて実行するヘルパー。
 */
export async function emitStageSummaryProgress(params: {
  stage: ProcessingStage;
  taskRegistry: SessionTaskRegistry;
  progressCallback?: (p: ProgressInfo) => void;
  currentTask: string;
}): Promise<StageSummary> {
  const { stage, taskRegistry, progressCallback, currentTask } = params;
  const records = await taskRegistry.listStageRecords(stage);
  const summary = summarizeStageRecords(records);
  progressCallback?.(buildStageSummaryProgressInfo({ stage, summary, currentTask }));
  return summary;
}
