import type { BuildStage } from '@hierarchidb/components/build-stage';
import { isTaskSkipped } from '../../../../../common/utils/taskMessages.ts';
import { sortTransformTasks, sortVectorTileTasks } from '../../useTaskItemCardList.ts';
import type { TaskItemWithMetadata } from '../../TaskItemCardListCard/TaskItemCardListCard.tsx';

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
    const stageTasks = tasksByStage[viewportRange.stageId] ?? [];
    const ordered = viewportRange.stageId === 'vt'
      ? sortVectorTileTasks(stageTasks)
      : viewportRange.stageId === 'transform'
        ? sortTransformTasks(stageTasks)
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
  const isTransformStage = stage.id === 'transform';
  const isSingleTransformFlow = stages.length === 1;
  const hasSingleTransformSource = (tasksByStage.fetch?.length ?? 0) > 0;
  const hasNoTransformTasks = (tasksByStage.transform?.length ?? 0) === 0;

  if (isTransformStage && isSingleTransformFlow && hasNoTransformTasks && hasSingleTransformSource) {
    return 'fetch';
  }

  return stage.id;
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
    const stageTasks = tasksByStage[sourceStageId] ?? [];
    nextStageOffsets.set(stage.id, totalCount);
    const plannedStageTotal = Math.max(0, stageTotals?.[stage.id]?.total ?? 0);
    const orderedTasks = sourceStageId === 'vt'
      ? sortVectorTileTasks(stageTasks)
      : sourceStageId === 'transform'
        ? sortTransformTasks(stageTasks)
        : stageTasks;
    const expectedStageTotal = Math.max(orderedTasks.length, plannedStageTotal);
    nextStageCounts.set(stage.id, expectedStageTotal);

    orderedTasks.forEach((task) => {
      const statusValue = (task.status ?? '').toString().toLowerCase();
      const isSkipped = isTaskSkipped(task.display, task.message);
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
      const isDimmed =
        (isSkipped && !filter.skippedMode)
        || (statusValue === 'failed' && !filter.failedMode)
        || ((statusValue === 'completed' || statusValue === 'recycled') && !filter.completedMode);
      const isExternalStage = sourceStageId !== stage.id;
      nextSegments.push({
        fill,
        fillOpacity: isDimmed ? 0.4 : 1,
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
