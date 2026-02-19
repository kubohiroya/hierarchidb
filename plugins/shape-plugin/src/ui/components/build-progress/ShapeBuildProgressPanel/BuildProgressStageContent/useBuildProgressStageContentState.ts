import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useBuildStageFilter } from '@hierarchidb/components';
import { useAtomValue, useSetAtom } from 'jotai';
import { type TaskItemWithMetadata } from '~/ui/components/build-progress/taskItemCardList/types';
import { sortTransformTasks, sortVectorTileTasks } from '~/ui/components/build-progress/taskItemCardList/useTaskItemCardList';
import { taskScrollTargetAtom, taskViewportRangeAtom } from '~/ui/atoms/shapeBuildProgressAtoms';
import { isTaskSkipped } from '~/common/utils/taskMessages';

type BuildProgressStageContentStateArgs = {
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
  resolveStatusColor: (
    statusValue?: string,
    skipped?: boolean,
  ) => 'default' | 'success' | 'error' | 'warning' | 'info';
  resolveTaskTitle: (task: TaskItemWithMetadata) => string;
  t: (key: string, fallback: string) => string;
  matchesSearchQuery: (task: TaskItemWithMetadata) => boolean;
};

export type BuildProgressStageContentState = {
  showHeader?: boolean;
  stage: BuildProgressStageContentStateArgs['stage'];
  stageValue: number;
  isTasksLoading: boolean;
  isTaskSummaryLoading: boolean;
  resolveStatusLabel: BuildProgressStageContentStateArgs['resolveStatusLabel'];
  resolveStatusColor: BuildProgressStageContentStateArgs['resolveStatusColor'];
  resolveTaskTitle: BuildProgressStageContentStateArgs['resolveTaskTitle'];
  t: BuildProgressStageContentStateArgs['t'];
  displayTasks: TaskItemWithMetadata[];
  hasTasks: boolean;
  showSummarySkeleton: boolean;
  showTaskSkeleton: boolean;
  hasSummaryTasks: boolean;
  hasOnlyQueuedInViewport: boolean;
  showUpArrow: boolean;
  showDownArrow: boolean;
  scrollTargetTaskId?: string;
  scrollRequestId?: number;
  upTargetTaskId?: string;
  downTargetTaskId?: string;
  listWrapperRef: React.RefObject<HTMLDivElement | null>;
  listScrollRef: React.RefObject<HTMLDivElement | null>;
  handleScrollToDirection: (direction: 'up' | 'down') => void;
  setAriaScrollToTaskId: (taskId: string) => void;
  disableVirtualization: boolean;
};

export const useBuildProgressStageContentState = ({
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
}: BuildProgressStageContentStateArgs): BuildProgressStageContentState => {
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

  const filteredTasks = useMemo(() => stageTasks.filter((task) => {
    if (!matchesSearchQuery(task)) return false;
    if (isTaskSkipped(task.display, task.message)) return filter.skippedMode;
    if (task.status === 'failed') return filter.failedMode;
    if (task.status === 'completed' || task.status === 'recycled') return filter.completedMode;
    return true;
  }), [filter, stageTasks, matchesSearchQuery]);

  const orderedTasks = useMemo(() => {
    if (stage.id === 'vt') return sortVectorTileTasks(filteredTasks);
    if (stage.id === 'transform') return sortTransformTasks(filteredTasks);
    return filteredTasks;
  }, [filteredTasks, stage.id]);

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
    return { startIndex: clampedStart, endIndex: clampedEnd };
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
    orderedTasks.reduce<number[]>((acc, task, index) => {
      if (task.status === 'running' || task.status === 'queued') acc.push(index);
      return acc;
    }, [])
  ), [orderedTasks]);

  const hasRunningTask = useMemo(() => orderedTasks.some((task) => task.status === 'running'), [orderedTasks]);

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

  const setAriaScrollToTaskId = useCallback((targetTaskId: string) => {
    setScrollTarget({
      stageId: stage.id,
      taskId: targetTaskId,
      requestedAt: Date.now(),
    });
  }, [setScrollTarget, stage.id]);

  const handleScrollToDirection = useCallback((direction: 'up' | 'down') => {
    const targetTaskId = direction === 'up' ? upTargetTaskId : downTargetTaskId;
    if (!targetTaskId) return;
    setAriaScrollToTaskId(targetTaskId);
  }, [downTargetTaskId, setAriaScrollToTaskId, upTargetTaskId]);

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

  return {
    stage,
    stageValue,
    isTasksLoading,
    isTaskSummaryLoading,
    resolveStatusLabel,
    resolveStatusColor,
    resolveTaskTitle,
    t,
    displayTasks: orderedTasks,
    hasTasks,
    showSummarySkeleton,
    showTaskSkeleton,
    hasSummaryTasks,
    hasOnlyQueuedInViewport,
    showUpArrow,
    showDownArrow,
    scrollTargetTaskId: scrollToTaskId,
    scrollRequestId,
    upTargetTaskId,
    downTargetTaskId,
    listWrapperRef,
    listScrollRef,
    handleScrollToDirection,
    setAriaScrollToTaskId,
    disableVirtualization,
  };
};
