import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ArrowCircleDown as ArrowCircleDownIcon,
  ArrowCircleUp as ArrowCircleUpIcon,
} from '@mui/icons-material';
import { Box, Skeleton, Stack, Tooltip, Typography, IconButton } from '@mui/material';
import { useBuildStageFilter } from '@hierarchidb/components';
import { useAtomValue, useSetAtom } from 'jotai';
import { isTaskSkipped } from '../../../../common/utils/taskMessages.js';
import {
  taskScrollTargetAtom,
  taskViewportRangeAtom,
} from '../../../atoms/shapeBuildProgressAtoms.js';
import type { TaskItemWithMetadata } from '../useTaskItemCardList.js';
import { TaskItemCardListCard } from '../TaskItemCardListCard/TaskItemCardListCard.js';
import { sortTransformTasks, sortVectorTileTasks } from '../useTaskItemCardList.js';

type BuildProgressStageContentProps = {
  showHeader?: boolean;
  stage: {
    id: string;
    title: string;
    description?: string | null;
  };
  stageValue: number;
  tasksByStage: Record<string, TaskItemWithMetadata[]>;
  paneProgress?: Array<{
    paneId?: string;
    progress?: number;
    taskCount?: number;
    completedCount?: number;
    status?: string;
  }>;
  isTaskSummaryLoading: boolean;
  isTasksLoading: boolean;
  resolveStatusLabel: (statusValue?: string, skipped?: boolean) => string;
  resolveStatusColor: (statusValue?: string, skipped?: boolean) => 'default' | 'success' | 'error' | 'warning' | 'info';
  resolveTaskTitle: (task: TaskItemWithMetadata) => string;
  t: (key: string, fallback: string) => string;
  matchesSearchQuery: (task: TaskItemWithMetadata) => boolean;
};

export const BuildProgressStageContent = ({
  showHeader,
  stage,
  stageValue,
  tasksByStage,
  paneProgress,
  isTaskSummaryLoading,
  isTasksLoading,
  resolveStatusLabel,
  resolveStatusColor,
  resolveTaskTitle,
  t,
  matchesSearchQuery,
}: BuildProgressStageContentProps) => {
  const filter = useBuildStageFilter();
  const stageTasks = tasksByStage[stage.id] ?? [];
  const scrollTarget = useAtomValue(taskScrollTargetAtom);
  const setScrollTarget = useSetAtom(taskScrollTargetAtom);
  const viewportRange = useAtomValue(taskViewportRangeAtom);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const listWrapperRef = useRef<HTMLDivElement | null>(null);
  const scrollToTaskId = scrollTarget?.stageId === stage.id ? scrollTarget.taskId : undefined;
  const scrollRequestId = scrollTarget?.requestedAt;
  const disableVirtualization = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('noTaskVirtual');

  const filteredTasks = stageTasks.filter((task) => {
    if (!matchesSearchQuery(task)) return false;
    if (isTaskSkipped(task.display, task.message)) return filter.skippedMode;
    if (task.status === 'failed') return filter.failedMode;
    if (task.status === 'completed' || task.status === 'recycled') return filter.completedMode;
    return true;
  });

  const orderedTasks = stage.id === 'vt'
    ? sortVectorTileTasks(filteredTasks)
    : stage.id === 'transform'
      ? sortTransformTasks(filteredTasks)
    : filteredTasks;

  const displayTasks = orderedTasks;
  const hasTasks = filteredTasks.length > 0;
  const stagePane = paneProgress?.find((entry) => entry.paneId === stage.id);
  const hasSummaryTasks = (stagePane?.taskCount ?? 0) > 0;
  const showSummarySkeleton = isTaskSummaryLoading && !hasTasks && !hasSummaryTasks;
  const showTaskSkeleton = !hasTasks && !showSummarySkeleton && isTasksLoading;

  const requestedTargetIndex = useMemo(() => {
    if (!scrollToTaskId) return null;
    const index = orderedTasks.findIndex((task) => task.taskId === scrollToTaskId);
    return index >= 0 ? index : null;
  }, [orderedTasks, scrollToTaskId]);

  const viewportIndices = useMemo(() => {
    if (orderedTasks.length === 0) return null;
    if (viewportRange?.stageId !== stage.id || viewportRange == null) return null;
    const maxIndex = orderedTasks.length - 1;
    const clampedStart = Math.min(Math.max(viewportRange.startIndex, 0), maxIndex);
    const clampedEnd = Math.min(Math.max(viewportRange.endIndex, clampedStart), maxIndex);
    return {
      startIndex: clampedStart,
      endIndex: clampedEnd,
    };
  }, [orderedTasks.length, stage.id, viewportRange]);

  const currentIndex = useMemo(() => {
    if (orderedTasks.length === 0) return null;
    if (viewportIndices == null) return 0;
    if (requestedTargetIndex !== null
      && requestedTargetIndex >= viewportIndices.startIndex
      && requestedTargetIndex <= viewportIndices.endIndex) {
      return requestedTargetIndex;
    }
    return Math.floor((viewportIndices.startIndex + viewportIndices.endIndex) / 2);
  }, [orderedTasks.length, requestedTargetIndex, viewportIndices]);

  const activeTargetIndices = useMemo(() => (
    orderedTasks.reduce<number[]>((acc, task, index: number) => {
      if (task.status === 'running' || task.status === 'queued') {
        acc.push(index);
      }
      return acc;
    }, [])
  ), [orderedTasks]);

  const hasRunningTask = useMemo(
    () => orderedTasks.some((task) => task.status === 'running'),
    [orderedTasks],
  );

  const hasOnlyQueuedInViewport = useMemo(() => {
    if (viewportIndices == null) return false;
    for (let i = viewportIndices.startIndex; i <= viewportIndices.endIndex; i += 1) {
      if (orderedTasks[i]?.status !== 'queued') return false;
    }
    return true;
  }, [orderedTasks, viewportIndices]);

  const upTargetIndex = useMemo(() => {
    if (currentIndex == null) return null;
    for (let i = activeTargetIndices.length - 1; i >= 0; i -= 1) {
      const candidate = activeTargetIndices[i];
      if (candidate == null) continue;
      if (candidate < currentIndex) return candidate;
    }
    return null;
  }, [activeTargetIndices, currentIndex]);

  const downTargetIndex = useMemo(() => {
    if (currentIndex == null) return null;
    for (const candidate of activeTargetIndices) {
      if (candidate > currentIndex) return candidate;
    }
    return null;
  }, [activeTargetIndices, currentIndex]);

  const upTargetTaskId = upTargetIndex === null ? undefined : orderedTasks[upTargetIndex]?.taskId;
  const downTargetTaskId = downTargetIndex === null ? undefined : orderedTasks[downTargetIndex]?.taskId;
  const isScrollTargetReached = requestedTargetIndex !== null
    && currentIndex !== null
    && currentIndex === requestedTargetIndex;
  const viewportStartIndex = viewportIndices?.startIndex;
  const viewportEndIndex = viewportIndices?.endIndex;
  const showUpArrow = !isScrollTargetReached
    && !hasOnlyQueuedInViewport
    && hasRunningTask
    && upTargetIndex !== null
    && currentIndex !== null
    && upTargetIndex < currentIndex
    && (viewportStartIndex == null || upTargetIndex < viewportStartIndex);
  const showDownArrow = !isScrollTargetReached
    && !hasOnlyQueuedInViewport
    && hasRunningTask
    && downTargetIndex !== null
    && currentIndex !== null
    && currentIndex < downTargetIndex
    && (viewportEndIndex == null || downTargetIndex > viewportEndIndex);

  const handleScrollToDirection = useCallback((direction: 'up' | 'down') => {
    const targetTaskId = direction === 'up' ? upTargetTaskId : downTargetTaskId;
    if (!targetTaskId) return;
    setScrollTarget({
      stageId: stage.id,
      taskId: targetTaskId,
      requestedAt: Date.now(),
    });
  }, [downTargetTaskId, setScrollTarget, stage.id, upTargetTaskId]);

  useEffect(() => {
    const wrapper = listWrapperRef.current;
    if (!wrapper) return;
    const handleWheel = (event: globalThis.WheelEvent) => {
      event.stopPropagation();
      const scrollEl = listScrollRef.current;
      if (!scrollEl) return;
      if (scrollEl.scrollHeight <= scrollEl.clientHeight) {
        event.preventDefault();
        return;
      }
      scrollEl.scrollTop += event.deltaY;
      event.preventDefault();
    };
    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      wrapper.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <Stack spacing={1} sx={{ p: 2, height: '100%', minHeight: 0 }}>
      {showSummarySkeleton ? (
        <>
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="rounded" height={88} />
        </>
      ) : showTaskSkeleton ? (
        <>
          <Skeleton variant="text" width="35%" />
          <Skeleton variant="rounded" height={88} />
        </>
      ) : !hasTasks ? (
        <>
          {showHeader ? (
            <>
              <Typography variant="subtitle2">{stage.title}</Typography>
              {stage.description ? (
                <Typography variant="body2" color="text.secondary">
                  {stage.description}
                </Typography>
              ) : null}
            </>
          ) : null}
          <Typography variant="caption" color="text.secondary">
            {hasSummaryTasks
              ? t('stage.tasks.summaryOnly', 'Tasks are summarized. Detailed list is unavailable.')
              : t('stage.tasks.empty', 'No tasks yet.')}
          </Typography>
        </>
      ) : (
        <Box
          sx={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
          ref={listWrapperRef}
        >
          <TaskItemCardListCard
            ref={listScrollRef}
            stageId={stage.id}
            tasks={displayTasks}
            stageValue={stageValue}
            resolveStatusLabel={resolveStatusLabel}
            resolveStatusColor={resolveStatusColor}
            resolveTaskTitle={resolveTaskTitle}
            scrollToTaskId={scrollToTaskId}
            scrollRequestId={scrollRequestId}
            virtualize={!disableVirtualization}
          />
          {showUpArrow ? (
            <Tooltip title={t('stage.progress.scrollToRunningUp', 'Scroll up to running or queued task')}>
              <IconButton
                aria-label={t('stage.progress.scrollToRunningUp', 'Scroll up to running or queued task')}
                color="primary"
                onClick={() => handleScrollToDirection('up')}
                sx={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  transform: 'translateX(-50%)',
                  bgcolor: 'transparent',
                  boxShadow: 'none',
                  zIndex: 2,
                  width: 56,
                  height: 56,
                  '&:hover': { bgcolor: 'transparent' },
                }}
              >
                <ArrowCircleUpIcon sx={{ fontSize: 48 }} />
              </IconButton>
            </Tooltip>
          ) : null}
          {showDownArrow ? (
            <Tooltip title={t('stage.progress.scrollToRunningDown', 'Scroll down to running or queued task')}>
              <IconButton
                aria-label={t('stage.progress.scrollToRunningDown', 'Scroll down to running or queued task')}
                color="primary"
                onClick={() => handleScrollToDirection('down')}
                sx={{
                  position: 'absolute',
                  left: '50%',
                  bottom: 0,
                  transform: 'translateX(-50%)',
                  bgcolor: 'transparent',
                  boxShadow: 'none',
                  zIndex: 2,
                  width: 56,
                  height: 56,
                  '&:hover': { bgcolor: 'transparent' },
                }}
              >
                <ArrowCircleDownIcon sx={{ fontSize: 48 }} />
              </IconButton>
            </Tooltip>
          ) : null}
        </Box>
      )}
    </Stack>
  );
};
