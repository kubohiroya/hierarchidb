import { useMemo } from 'react';
import type { BuildStage, BuildStatus } from '@hierarchidb/components';
import type { BatchTaskSummary } from '@hierarchidb/batch-api';
import { buildTaskCountSummary } from '../utils/taskProgressSummary.js';

type TaskStageCarrier = BatchTaskSummary & { taskType?: string; type?: string; stage?: string };

const resolveTaskStage = (task: TaskStageCarrier): string | undefined => (
  task.taskType ?? task.type ?? task.stage
);

const toStageKey = (task: TaskStageCarrier): string => {
  const candidate = resolveTaskStage(task);
  if (!candidate) return 'unknown';
  if (candidate === 'vectortile') return 'vectorTiles';
  if (candidate === 'extract1') return 'extract1';
  if (candidate === 'extract2') return 'extract2';
  if (candidate === 'wait' || candidate === 'process' || candidate === 'success' || candidate === 'error') {
    return task.type ?? task.taskType ?? 'unknown';
  }
  return candidate;
};

const isSkippedTask = (task: BatchTaskSummary): boolean => {
  const message = task.message;
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  return normalized === 'skipped' || normalized.startsWith('skipped:');
};

export const useBuildTaskProgress = <T extends BatchTaskSummary>(
  stages: BuildStage[],
  taskType: string | undefined,
  overallProgress: number,
  buildStatus: BuildStatus,
  tasks: T[],
) => {
  const stageProgress = useMemo(() => {
    const map: Record<string, number> = {};
    if (buildStatus === 'completed') {
      stages.forEach((stage) => {
        map[stage.id] = 100;
      });
      return map;
    }
    const stageIndex = stages.findIndex((stage) => stage.id === taskType);
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
  }, [buildStatus, taskType, overallProgress, stages]);

  const tasksByStage = useMemo(() => {
    const grouped: Record<string, T[]> = {};
    tasks.forEach((task) => {
      const key = toStageKey(task);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });
    return grouped;
  }, [tasks]);

  const paneProgress = useMemo(() => {
    return stages.map((stage) => {
      const stageTasks = tasksByStage[stage.id] ?? [];
      const taskCount = stageTasks.length;
      const counts = buildTaskCountSummary(stageTasks, isSkippedTask);
      const taskCountEffective = Math.max(0, counts.total - counts.skipped);
      const completedCount = counts.completed;
      const failedCount = counts.failed;
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
  }, [buildStatus, stages, tasksByStage]);

  return {
    stageProgress,
    tasksByStage,
    paneProgress,
  };
};
