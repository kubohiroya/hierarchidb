import type { BuildStage } from '@hierarchidb/ui-build-progress/build-stage';
import { isTaskSkipped } from '~/common/utils/taskMessageUtils';
import { resolveTaskMetadataMessage } from '~/common/utils/taskMessageUtils';
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

export type BuildSessionStageProgressBarSegment = {
  fill: string;
  fillOpacity: number;
  stageId: string;
  taskId?: string;
  title: string;
  width: number;
};

export type TaskProgressVisibilityFilter = {
  skippedMode: boolean;
  failedMode: boolean;
  completedMode: boolean;
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
  filter: TaskProgressVisibilityFilter;
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
  filter: TaskProgressVisibilityFilter,
) => {
  let viewportStartIndex: number | null = null;
  let viewportEndIndex: number | null = null;
  if (viewportRange?.stageId && viewportRange.startTaskId && viewportRange.endTaskId) {
    const stageTasks = resolveTasksByStageId(tasksByStage, viewportRange.stageId);
    const ordered = resolveVisibleOrderedTasks(viewportRange.stageId, stageTasks, filter);
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
  filter: TaskProgressVisibilityFilter;
}) => {
  const { statusValue, isSkipped, filter } = params;

  if (!filter.skippedMode && !filter.failedMode && !filter.completedMode) {
    return true;
  }

  if (isSkipped) return filter.skippedMode;
  if (statusValue === 'failed') return filter.failedMode;
  if (statusValue === 'completed' || statusValue === 'recycled') return filter.completedMode;

  return false;
};

const resolveVisibleOrderedTasks = (
  stageId: string,
  stageTasks: TaskItemWithMetadata[],
  filter: TaskProgressVisibilityFilter,
): TaskItemWithMetadata[] => {
  const orderedTasks = isTileEmitLikeStageId(stageId)
    ? sortVectorTileTasks(stageTasks)
    : isGeometryLikeStageId(stageId)
      ? sortGeometryTasks(stageTasks)
      : stageTasks;

  return orderedTasks.filter((task) => {
    const statusValue = task.status.toLowerCase();
    const isSkipped = isTaskSkipped(task.display, resolveTaskMetadataMessage(task.metadata));
    return shouldIncludeTask({ statusValue, isSkipped, filter });
  });
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

  const nextSegments: BuildSessionStageProgressBarSegment[] = [];
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
    const visibleOrderedTasks = resolveVisibleOrderedTasks(sourceStageId, stageTasks, filter);
    const hasActiveFilter = filter.skippedMode || filter.failedMode || filter.completedMode;
    const expectedStageTotal = hasActiveFilter
      ? visibleOrderedTasks.length
      : Math.max(orderedTasks.length, plannedStageTotal);
    nextStageCounts.set(stage.id, expectedStageTotal);

    visibleOrderedTasks.forEach((task) => {
      const statusValue = task.status.toLowerCase();
      const isSkipped = isTaskSkipped(task.display, resolveTaskMetadataMessage(task.metadata));

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

    const waitingCount = hasActiveFilter ? 0 : expectedStageTotal - orderedTasks.length;
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
