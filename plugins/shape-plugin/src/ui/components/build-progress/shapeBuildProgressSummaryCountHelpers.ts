import type { TaskCountSummary } from '../../../../../../packages/ui/build';
import type { BuildProgress } from './shapeBuildProgressMapping.js';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import type { BuildTaskSummary } from '../../../../../../packages/build-api';
import type { TaskStageCarrier } from '../../../../../../packages/ui/build';

export type StageCountInfo = { counts: TaskCountSummary; hasIncomplete: boolean };

export const createStageTaskCounts = ({
  stages,
  tasksByStage,
  isSkippedTask,
  isExcludedTask,
}: {
  stages: BuildStage[];
  tasksByStage: Record<string, (BuildTaskSummary & TaskStageCarrier)[]>;
  isSkippedTask: (task: BuildTaskSummary & TaskStageCarrier) => boolean;
  isExcludedTask: (task: BuildTaskSummary & TaskStageCarrier) => boolean;
}): Record<string, StageCountInfo> => (
  stages.reduce<Record<string, StageCountInfo>>((acc, stage) => {
    const stageTasks = tasksByStage[stage.id] ?? [];
    if (stageTasks.length === 0) {
      acc[stage.id] = {
        counts: { total: 0, completed: 0, failed: 0, skipped: 0 },
        hasIncomplete: false,
      };
      return acc;
    }

    const counts = {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    } as TaskCountSummary;
    for (const task of stageTasks) {
      if (isExcludedTask(task)) {
        continue;
      }
      counts.total += 1;
      if (isSkippedTask(task)) {
        counts.skipped += 1;
        continue;
      }
      if (task.status === 'failed') {
        counts.failed += 1;
        continue;
      }
      if (task.status === 'completed') {
        counts.completed += 1;
      }
    }

    const done = counts.completed + counts.failed + counts.skipped;
    acc[stage.id] = {
      counts,
      hasIncomplete: done < counts.total,
    };
    return acc;
  }, {})
);

export const buildStageCountPlan = ({
  stages,
  stageTaskCounts,
  buildStatus,
  effectiveProgress,
}: {
  stages: BuildStage[];
  stageTaskCounts: Record<string, StageCountInfo>;
  buildStatus: BuildStatus;
  effectiveProgress?: BuildProgress | null;
}): Record<string, StageCountInfo> =>
  stages.reduce<Record<string, StageCountInfo>>((acc, stage) => {
    const stageInfo = stageTaskCounts[stage.id];
    const actualCounts = stageInfo?.counts ?? { total: 0, completed: 0, failed: 0, skipped: 0 };
    const shouldUsePlanned = actualCounts.total > 0 || buildStatus === 'running' || buildStatus === 'paused';
    const plannedCounts = shouldUsePlanned ? effectiveProgress?.stageTotals?.[stage.id as 'fetch' | 'transform' | 'vt'] : undefined;
    const mergedCompleted = Math.max(actualCounts.completed, plannedCounts?.completed ?? 0);
    const mergedFailed = Math.max(actualCounts.failed, plannedCounts?.failed ?? 0);
    const mergedSkipped = Math.max(actualCounts.skipped, plannedCounts?.skipped ?? 0);
    const mergedDone = mergedCompleted + mergedFailed + mergedSkipped;
    const mergedTotal = Math.max(actualCounts.total, plannedCounts?.total ?? 0, mergedDone);

    acc[stage.id] = {
      counts: {
        total: mergedTotal,
        completed: mergedCompleted,
        failed: mergedFailed,
        skipped: mergedSkipped,
      },
      hasIncomplete: mergedDone < mergedTotal,
    };
    return acc;
  }, {});

export const makeStageTotals = (stages: BuildStage[], stageCountsWithPlan: Record<string, StageCountInfo>): Record<string, TaskCountSummary> => (
  stages.reduce<Record<string, TaskCountSummary>>((acc, stage) => {
    acc[stage.id] = stageCountsWithPlan[stage.id]?.counts
      ?? { total: 0, completed: 0, failed: 0, skipped: 0 };
    return acc;
  }, {})
);
