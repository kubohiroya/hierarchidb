import type { BuildStage } from '@hierarchidb/ui-build-progress/build-stage';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';
import { resolveStageAliasArray } from '~/ui/components/build-progress/stageIdAliases';

export type StageTaskScan = Record<
  string,
  {
    hasRunning: boolean;
    failedTask: ShapeBuildTaskSummary | null;
    runningCount: number;
    queuedCount: number;
    totalCount: number;
  }
>;

export type FailureInfo = {
  stageId?: string;
  title?: string;
  message?: string;
};

export const buildStageTaskScan = (
  stages: BuildStage[],
  tasksByStage: Record<string, ShapeBuildTaskSummary[]>
): StageTaskScan =>
  stages.reduce<StageTaskScan>((acc, stage) => {
    const stageTasks = resolveStageAliasArray(tasksByStage, stage.id);
    let hasRunning = false;
    let failedTask: ShapeBuildTaskSummary | null = null;
    let runningCount = 0;
    let queuedCount = 0;

    for (const task of stageTasks) {
      if (task.status === 'running') {
        runningCount += 1;
        hasRunning = true;
      }
      if (task.status === 'queued') {
        queuedCount += 1;
      }
      if (!failedTask && task.status === 'failed') {
        failedTask = task;
      }
    }

    acc[stage.id] = {
      hasRunning,
      failedTask,
      runningCount,
      queuedCount,
      totalCount: stageTasks.length,
    };
    return acc;
  }, {});
