import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useBuildStageFilter } from '@hierarchidb/ui-build-progress';
import { useAtomValue, useSetAtom } from 'jotai';
import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import { type TaskItemWithMetadata } from '~/ui/components/build-progress/taskItemCardList/types';
import { sortGeometryTasks, sortVectorTileTasks } from '~/ui/components/build-progress/taskItemCardList/useTaskItemCardList';
import { taskScrollTargetAtom, taskViewportRangeByStageAtom } from '~/ui/atoms/shapeBuildProgressAtoms';
import { isTaskSkipped } from '~/common/utils/taskMessages';
import { resolveTaskMetadataMessage } from '~/common/utils/taskMessages';
import type { ShapeBuildConfig } from '~/common/types/BuildTaskResult';
import {
  isGeometryLikeStageId,
  isTileEmitLikeStageId,
  normalizeUiStageId,
  resolveStageAliasArray,
} from '~/ui/components/build-progress/stageIdAliases';

type BuildSessionStageCardStateArgs = {
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
  isStartupPending: boolean;
  buildStatus: BuildStatus;
  resolveStatusLabel: (statusValue?: string, skipped?: boolean) => string;
  resolveStatusColor: (
    statusValue?: string,
    skipped?: boolean,
  ) => 'default' | 'success' | 'error' | 'warning' | 'info';
  resolveTaskTitle: (task: TaskItemWithMetadata) => string;
  t: (key: string, fallback: string) => string;
  matchesSearchQuery: (task: TaskItemWithMetadata) => boolean;
  isDetailFloatingWindowOpen: boolean;
  isOpeningPending?: boolean;
  buildConfig?: ShapeBuildConfig;
  onOpenDetailFloatingWindow: () => void;
  onCloseDetailFloatingWindow: () => void;
  floatingWindowZIndex: number;
  onRequestBringFloatingWindowToFront: () => void;
};

export type BuildSessionStageCardState = {
  showHeader?: boolean;
  stage: BuildSessionStageCardStateArgs['stage'];
  stageValue: number;
  isTasksLoading: boolean;
  isTaskSummaryLoading: boolean;
  resolveStatusLabel: BuildSessionStageCardStateArgs['resolveStatusLabel'];
  resolveStatusColor: BuildSessionStageCardStateArgs['resolveStatusColor'];
  resolveTaskTitle: BuildSessionStageCardStateArgs['resolveTaskTitle'];
  t: BuildSessionStageCardStateArgs['t'];
  displayTasks: TaskItemWithMetadata[];
  hasTasks: boolean;
  showSummarySkeleton: boolean;
  showTaskSkeleton: boolean;
  hasSummaryTasks: boolean;
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
  isDetailFloatingWindowOpen: boolean;
  isOpeningPending: boolean;
  buildConfig?: ShapeBuildConfig;
  onOpenDetailFloatingWindow: () => void;
  onCloseDetailFloatingWindow: () => void;
  floatingWindowZIndex: number;
  onRequestBringFloatingWindowToFront: () => void;
};

export const useBuildSessionStageCardState = ({
  stage,
  stageValue,
  tasksByStage,
  paneProgress,
  isTaskSummaryLoading,
  isTasksLoading,
  isStartupPending,
  buildStatus,
  resolveStatusLabel,
  resolveStatusColor,
  resolveTaskTitle,
  t,
  matchesSearchQuery,
  isDetailFloatingWindowOpen,
  isOpeningPending = false,
  buildConfig,
  onOpenDetailFloatingWindow,
  onCloseDetailFloatingWindow,
  floatingWindowZIndex,
  onRequestBringFloatingWindowToFront,
}: BuildSessionStageCardStateArgs): BuildSessionStageCardState => {
  const filter = useBuildStageFilter();
  const stageTasks = resolveStageAliasArray(tasksByStage, stage.id);
  const isBuildInProgressState = buildStatus === 'running' || buildStatus === 'paused';
  const cachedTasksByStageRef = useRef<Record<string, TaskItemWithMetadata[]>>({});
  const previousBuildStatusRef = useRef<BuildStatus>(buildStatus);

  useEffect(() => {
    if (previousBuildStatusRef.current === buildStatus) return;
    if (isBuildInProgressState && ![
      'running',
      'paused',
    ].includes(previousBuildStatusRef.current)) {
      cachedTasksByStageRef.current = {};
    }
    previousBuildStatusRef.current = buildStatus;
  }, [buildStatus, isBuildInProgressState]);

  useEffect(() => {
    if (!isBuildInProgressState) return;
    if (stageTasks.length > 0) {
      cachedTasksByStageRef.current[stage.id] = stageTasks;
    }
  }, [isBuildInProgressState, stage.id, stageTasks]);
  const stageTasksForDisplay = useMemo(() => {
    if (isBuildInProgressState && stageTasks.length === 0) {
      return cachedTasksByStageRef.current[stage.id] ?? [];
    }
    return stageTasks;
  }, [isBuildInProgressState, stage.id, stageTasks]);
  const scrollTarget = useAtomValue(taskScrollTargetAtom);
  const setScrollTarget = useSetAtom(taskScrollTargetAtom);
  const viewportRangeByStage = useAtomValue(taskViewportRangeByStageAtom);
  const viewportRange = viewportRangeByStage[normalizeUiStageId(stage.id) ?? stage.id] ?? null;
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const listWrapperRef = useRef<HTMLDivElement | null>(null);
  const scrollToTaskId = normalizeUiStageId(scrollTarget?.stageId) === normalizeUiStageId(stage.id)
    ? scrollTarget?.taskId
    : undefined;
  const scrollRequestId = scrollTarget?.requestedAt;
  const disableVirtualization = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('noTaskVirtual');

  const filteredTasks = useMemo(() => stageTasksForDisplay.filter((task) => {
    if (!matchesSearchQuery(task)) return false;
    if (isTaskSkipped(task.display, resolveTaskMetadataMessage(task.metadata))) return filter.skippedMode;
    if (task.status === 'failed') return filter.failedMode;
    if (task.status === 'completed' || task.status === 'recycled') return filter.completedMode;
    return true;
  }), [filter, matchesSearchQuery, stageTasksForDisplay]);

  const orderedTasks = useMemo(() => {
    if (isTileEmitLikeStageId(stage.id)) return sortVectorTileTasks(filteredTasks);
    if (isGeometryLikeStageId(stage.id)) return sortGeometryTasks(filteredTasks);
    return filteredTasks;
  }, [filteredTasks, stage.id]);

  const hasTasks = filteredTasks.length > 0;
  const stagePane = paneProgress?.find((entry) => normalizeUiStageId(entry.paneId) === normalizeUiStageId(stage.id));
  const hasSummaryTasks = (stagePane?.taskCount ?? 0) > 0;
  const showSummarySkeleton = isTaskSummaryLoading && !hasTasks && !hasSummaryTasks;
  const showTaskSkeleton = !hasTasks
    && !showSummarySkeleton
    && isTasksLoading
    && (isBuildInProgressState || isStartupPending);

  const requestedTargetIndex = useMemo(() => {
    if (!scrollToTaskId) return null;
    const index = orderedTasks.findIndex((task) => task.taskId === scrollToTaskId);
    return index >= 0 ? index : null;
  }, [orderedTasks, scrollToTaskId]);

  const viewportIndices = useMemo(() => {
    if (orderedTasks.length === 0) return null;
    if (viewportRange == null) return null;
    const maxIndex = orderedTasks.length - 1;
    const clampedStart = Math.min(Math.max(viewportRange.startIndex, 0), maxIndex);
    const clampedEnd = Math.min(Math.max(viewportRange.endIndex, clampedStart), maxIndex);
    return { startIndex: clampedStart, endIndex: clampedEnd };
  }, [orderedTasks.length, viewportRange]);

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

  const hasActiveTargetTask = useMemo(() => (
    orderedTasks.some((task) => task.status === 'running' || task.status === 'queued')
  ), [orderedTasks]);

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
  // Show the up arrow only when viewport info is available AND the nearest up-target
  // is above the visible range. When viewportStartIndex is null (viewport not yet
  // measured), hide the button to avoid false positives.
  // currentIndex !== null and upTargetIndex < currentIndex are implied when
  // viewportStartIndex != null, since upTargetIndex < viewportStartIndex <= currentIndex.
  const showUpArrow = !isScrollTargetReached
    && hasActiveTargetTask
    && upTargetIndex !== null
    && viewportStartIndex != null
    && upTargetIndex < viewportStartIndex;
  // Show the down arrow only when viewport info is available AND the nearest
  // down-target is below the visible range.
  // currentIndex !== null and currentIndex < downTargetIndex are implied when
  // viewportEndIndex != null, since currentIndex <= viewportEndIndex < downTargetIndex.
  const showDownArrow = !isScrollTargetReached
    && hasActiveTargetTask
    && downTargetIndex !== null
    && viewportEndIndex != null
    && downTargetIndex > viewportEndIndex;

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
    isDetailFloatingWindowOpen,
    isOpeningPending,
    buildConfig,
    onOpenDetailFloatingWindow,
    onCloseDetailFloatingWindow,
    floatingWindowZIndex,
    onRequestBringFloatingWindowToFront,
  };
};
