import type { BuildStage } from '@hierarchidb/components/build-stage';
import { isTaskSkipped } from '~/common/utils/taskMessages';
import { resolveTaskMetadataMessage } from '~/common/utils/taskMessages';
import { sortGeometryTasks, sortVectorTileTasks } from '~/ui/components/build-progress/taskItemCardList/useTaskItemCardList';
import type { TaskItemWithMetadata } from '~/ui/components/build-progress/taskItemCardList/types';
import {
  isGeometryLikeStageId,
  isTileEmitLikeStageId,
  normalizeUiStageId,
} from '~/ui/components/build-progress/stageIdAliases';

export type ViewportRange = {
  stageId: string;
  startTaskId?: string;
  endTaskId?: string;
};

export type TaskProgressSegment = {
  fill: string;
  fillOpacity: number;
  stageId: string;
  taskId?: string;
  title: string;
  width: number;
};

export type TaskProgressComputeInput = {
  stages: BuildStage[];
  tasksByStage: Record<string, TaskItemWithMetadata[]>;
  stageTotals?: Record<string, { total: number }>;
  activeStageId?: string | null;
  buildStatus?: string;
  resolveTaskTitle: (task: TaskItemWithMetadata) => string;
  waitingColor: string;
  successColor: string;
  failedColor: string;
  runningColor: string;
  pausedColor: string;
  skippedColor: string;
  filter: {
    skippedMode: boolean;
    failedMode: boolean;
    completedMode: boolean;
  };
};

const resolveStatusColor = (params: {
  taskStatus: string;
  isSkipped: boolean;
  waitingColor: string;
  successColor: string;
  failedColor: string;
  runningColor: string;
  pausedColor: string;
  skippedColor: string;
}) => {
  const {
    taskStatus,
    isSkipped,
    waitingColor,
    successColor,
    failedColor,
    runningColor,
    pausedColor,
    skippedColor,
  } = params;

  if (isSkipped) return skippedColor;
  if (taskStatus === 'completed' || taskStatus === 'recycled') return successColor;
  if (taskStatus === 'failed') return failedColor;
  if (taskStatus === 'running') return runningColor;
  if (taskStatus === 'paused') return pausedColor;
  return waitingColor;
};

export const resolveViewportIndices = (
  viewportRange: ViewportRange | null | undefined,
  tasksByStage: Record<string, TaskItemWithMetadata[]>,
) => {
  let viewportStartIndex: number | null = null;
  let viewportEndIndex: number | null = null;
  if (viewportRange?.stageId && viewportRange.startTaskId && viewportRange.endTaskId) {
    const stageTasks = resolveTasksByStageId(tasksByStage, viewportRange.stageId);
    const ordered = isTileEmitLikeStageId(viewportRange.stageId)
      ? sortVectorTileTasks(stageTasks)
      : isGeometryLikeStageId(viewportRange.stageId)
        ? sortGeometryTasks(stageTasks)
        : stageTasks;
    const start = ordered.findIndex((task) => task.taskId === viewportRange.startTaskId);
    const end = ordered.findIndex((task) => task.taskId === viewportRange.endTaskId);
    if (start >= 0 && end >= 0) {
      viewportStartIndex = Math.min(start, end);
      viewportEndIndex = Math.max(start, end);
    }
  }
  return { viewportStartIndex, viewportEndIndex };
};

const resolveSourceStageId = (stage: BuildStage, stages: BuildStage[], tasksByStage: Record<string, TaskItemWithMetadata[]>) => {
  const isGeometryStage = isGeometryLikeStageId(stage.id);
  const isSingleGeometryFlow = stages.length === 1;
  const hasSingleGeometrySource = resolveTasksByStageId(tasksByStage, 'source').length > 0;
  const hasNoGeometryTasks = resolveTasksByStageId(tasksByStage, 'geometry').length === 0;

  if (isGeometryStage && isSingleGeometryFlow && hasNoGeometryTasks && hasSingleGeometrySource) {
    return 'source';
  }

  return stage.id;
};

const resolveTasksByStageId = (
  tasksByStage: Record<string, TaskItemWithMetadata[]>,
  stageId: string,
): TaskItemWithMetadata[] => {
  const direct = tasksByStage[stageId];
  if (direct) return direct;
  const canonical = normalizeUiStageId(stageId);
  if (!canonical) return [];
  const canonicalTasks = tasksByStage[canonical];
  if (canonicalTasks) return canonicalTasks;
  const aliasEntry = Object.entries(tasksByStage).find(([key]) => normalizeUiStageId(key) === canonical);
  return aliasEntry?.[1] ?? [];
};

const shouldIncludeTask = (params: {
  statusValue: string;
  isSkipped: boolean;
  filter: {
    skippedMode: boolean;
    failedMode: boolean;
    completedMode: boolean;
  };
}) => {
  const { statusValue, isSkipped, filter } = params;
  
  // Queued, Running, and Paused tasks are always visible (no filter UI for these)
  if (statusValue === 'queued' || statusValue === 'running' || statusValue === 'paused') {
    return true;
  }
  
  // If all filters are off, include all tasks
  if (!filter.skippedMode && !filter.failedMode && !filter.completedMode) {
    return true;
  }
  
  // OR logic: include if any active filter matches
  if (filter.skippedMode && isSkipped) return true;
  if (filter.failedMode && statusValue === 'failed') return true;
  if (filter.completedMode && (statusValue === 'completed' || statusValue === 'recycled')) return true;
  
  return false;
};

export const buildTaskProgressSegments = (params: TaskProgressComputeInput) => {
  const {
    stages,
    tasksByStage,
    stageTotals,
    filter,
    waitingColor,
    successColor,
    failedColor,
    runningColor,
    pausedColor,
    skippedColor,
    resolveTaskTitle,
  } = params;

  const nextSegments: TaskProgressSegment[] = [];
  const nextStageOffsets = new Map<string, number>();
  const nextStageCounts = new Map<string, number>();
  let totalCount = 0;

  stages.forEach((stage) => {
    const sourceStageId = resolveSourceStageId(stage, stages, tasksByStage);
    const stageTasks = resolveTasksByStageId(tasksByStage, sourceStageId);
    nextStageOffsets.set(stage.id, totalCount);
    const plannedStageTotal = Math.max(0, stageTotals?.[stage.id]?.total ?? 0);
    const orderedTasks = isTileEmitLikeStageId(sourceStageId)
      ? sortVectorTileTasks(stageTasks)
      : isGeometryLikeStageId(sourceStageId)
        ? sortGeometryTasks(stageTasks)
        : stageTasks;
    const expectedStageTotal = Math.max(orderedTasks.length, plannedStageTotal);
    nextStageCounts.set(stage.id, expectedStageTotal);

    orderedTasks.forEach((task) => {
      const statusValue = (task.status ?? '').toString().toLowerCase();
      const isSkipped = isTaskSkipped(task.display, resolveTaskMetadataMessage(task.metadata));
      
      // Check if task should be included based on filter
      if (!shouldIncludeTask({ statusValue, isSkipped, filter })) {
        return;
      }
      
      const fill = resolveStatusColor({
        taskStatus: statusValue,
        isSkipped,
        waitingColor,
        successColor,
        failedColor,
        runningColor,
        pausedColor,
        skippedColor,
      });
      const isExternalStage = sourceStageId !== stage.id;
      nextSegments.push({
        fill,
        fillOpacity: 1,
        stageId: stage.id,
        taskId: isExternalStage ? undefined : task.taskId,
        title: resolveTaskTitle(task),
        width: 1,
      });
      totalCount += 1;
    });

    const waitingCount = expectedStageTotal - orderedTasks.length;
    if (waitingCount > 0) {
      nextSegments.push({
        fill: waitingColor,
        fillOpacity: 1,
        stageId: stage.id,
        taskId: undefined,
        title: `${stage.title ?? stage.id} pending tasks`,
        width: waitingCount,
      });
      totalCount += waitingCount;
    }
  });

  const viewWidth = Math.max(1, nextSegments.reduce((total, segment) => total + segment.width, 0));

  return {
    segments: nextSegments,
    stageOffsets: nextStageOffsets,
    stageCounts: nextStageCounts,
    viewWidth,
  };
};
