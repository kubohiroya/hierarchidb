import { useMemo } from 'react';
import type { BuildStage, BuildStatus } from '@hierarchidb/components';
import type { BatchTaskSummary } from '@hierarchidb/common-api';

const toStageKey = (stage?: string): string => {
  if (!stage) return 'download';
  if (stage === 'vectortile') return 'vectorTiles';
  return stage;
};

const isSkippedTask = (task: BatchTaskSummary): boolean => task.message === 'skipped';

export const useBuildTaskProgress = (
  stages: BuildStage[],
  currentStage: string | undefined,
  overallProgress: number,
  buildStatus: BuildStatus,
  tasks: BatchTaskSummary[],
) => {
  const stageProgress = useMemo(() => {
    const map: Record<string, number> = {};
    if (buildStatus === 'completed') {
      stages.forEach((stage) => {
        map[stage.id] = 100;
      });
      return map;
    }
    const stageIndex = stages.findIndex((stage) => stage.id === currentStage);
    stages.forEach((stage, idx) => {
      if (stageIndex < 0) {
        map[stage.id] = 0;
      } else if (idx < stageIndex) {
        map[stage.id] = 100;
      } else if (idx === stageIndex) {
        map[stage.id] = Math.min(100, Math.max(0, overallProgress));
      } else {
        map[stage.id] = 0;
      }
    });
    return map;
  }, [buildStatus, currentStage, overallProgress, stages]);

  const tasksByStage = useMemo(() => {
    const grouped: Record<string, BatchTaskSummary[]> = {};
    tasks.forEach((task) => {
      const key = toStageKey(task.stage);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });
    return grouped;
  }, [tasks]);

  const paneProgress = useMemo(() => {
    return stages.map((stage) => {
      const stageTasks = tasksByStage[stage.id] ?? [];
      const taskCount = stageTasks.length;
      const skippedCount = stageTasks.filter(isSkippedTask).length;
      const taskCountEffective = Math.max(0, taskCount - skippedCount);
      const completedCount = stageTasks.filter((task) => task.status === 'completed' && !isSkippedTask(task)).length;
      const failedCount = stageTasks.filter(
        (task) => task.status === 'failed' || task.status === 'regression',
      ).length;
      const progressValue = taskCount > 0
        ? Math.round(stageTasks.reduce((sum, task) => sum + (task.progress ?? 0), 0) / taskCount)
        : 0;
      const derivedStatus = failedCount > 0 ? 'failed' : buildStatus;
      return {
        paneId: stage.id,
        progress: Math.min(100, Math.max(0, progressValue)),
        taskCount: taskCountEffective,
        completedCount,
        status: derivedStatus,
      };
    });
  }, [buildStatus, overallProgress, stageProgress, stages, tasksByStage]);

  return {
    stageProgress,
    tasksByStage,
    paneProgress,
  };
};
