import { useMemo } from 'react';
import type { BuildStage } from '@hierarchidb/ui-build-progress/build-stage';
import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import type { BuildTaskSummary } from '../../../../build-api';
import { buildTaskCountSummary } from '~/utils/taskProgressSummary';

const resolveTaskMetadataMessage = (metadata: Record<string, unknown> | undefined): string | undefined => {
  if (!metadata) return undefined;
  const keys = [
    'message',
    'statusMessage',
    'errorMessage',
    'detail.message',
    'result.message',
    'summary.message',
    'completionMessage',
  ];
  for (const path of keys) {
    const value = path.split('.').reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[segment];
    }, metadata);
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
};

const isSkippedTask = (task: BuildTaskSummary): boolean => {
  if (task.display?.kind === 'skip') return true;
  const message = resolveTaskMetadataMessage(task.metadata);
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  return normalized === 'skipped' || normalized.startsWith('skipped:');
};

export const useBuildTaskProgress = <T extends BuildTaskSummary>(
  stages: BuildStage[],
  inFlightStage: string | undefined,
  overallProgress: number,
  buildStatus: BuildStatus,
  tasks: T[],
  options?: { isExcludedTask?: (task: T) => boolean },
) => {
  const isExcludedTask = options?.isExcludedTask;
  const stageProgress = useMemo(() => {
    const map: Record<string, number> = {};
    if (buildStatus === 'completed') {
      stages.forEach((stage) => {
        map[stage.id] = 100;
      });
      return map;
    }
    const stageIndex = stages.findIndex((stage) => stage.id === inFlightStage);
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
  }, [buildStatus, inFlightStage, overallProgress, stages]);

  const tasksByStage = useMemo(() => {
    const grouped: Record<string, T[]> = {};
    tasks.forEach((task) => {
      const key = task.stage;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });
    return grouped;
  }, [tasks]);

  const paneProgress = useMemo(() => {
    return stages.map((stage) => {
      const stageTasks = tasksByStage[stage.id] ?? [];
      const effectiveTasks = isExcludedTask
        ? stageTasks.filter((task) => !isExcludedTask(task))
        : stageTasks;
      const taskCount = effectiveTasks.length;
      const counts = buildTaskCountSummary(stageTasks, isSkippedTask, { isExcluded: isExcludedTask });
      const taskCountEffective = Math.max(0, counts.total - counts.skipped);
      const completedCount = counts.completed;
      const failedCount = counts.failed;
      const progressValue = taskCount > 0
        ? Math.round(effectiveTasks.reduce((sum, task) => sum + (task.progress ?? 0), 0) / taskCount)
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
  }, [buildStatus, isExcludedTask, stages, tasksByStage]);

  return {
    stageProgress,
    tasksByStage,
    paneProgress,
  };
};
