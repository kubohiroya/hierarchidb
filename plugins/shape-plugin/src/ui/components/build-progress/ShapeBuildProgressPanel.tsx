import { type MouseEvent as ReactMouseEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Popover,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
  Tooltip,
  useTheme,
} from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown';
import ArrowCircleUpIcon from '@mui/icons-material/ArrowCircleUp';
import DownloadingIcon from '@mui/icons-material/Downloading';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import TimelapseIcon from '@mui/icons-material/Timelapse';
import { type NodeId, toNodeType } from '@hierarchidb/core-types';
import { BuildSessionProgressPanel, useBuildStageFilter } from '@hierarchidb/components';
import { BuildSessionLauncherPanel } from '@hierarchidb/ui-batch-progress';
import { DownloadRetryControls, type DownloadRetryConfig, WorkerNumberConfigCard } from '@hierarchidb/ui-accordion-config';
import { useAtomValue, useSetAtom } from 'jotai';
import type { TaskItemWithMetadata } from './TaskItemCardListCard.tsx';
import { TaskItemCardListCard, sortTransformTasks, sortVectorTileTasks } from './TaskItemCardListCard.tsx';
import type { ShapeEntity } from '../../../common/types/ShapeEntity.ts';
import type { ShapeProcessingConfig } from '../../../common/types/index.js';
import {
  DEFAULT_BUILD_CONFIG,
  DEFAULT_PROCESSING_CONFIG,
  mergeBuildConfig,
  mergeProcessingConfig,
} from '../../../common/types/index.js';
import { isTaskSkipped } from '../../../common/utils/taskMessages.ts';
import { useShapeBuildProgressPanel } from './useShapeBuildProgressPanel.ts';
import { useShapeBuildCacheActions } from '../build-config/useShapeBuildCacheActions.ts';
import type { TaskProgressSummary } from '../../atoms/shapeBuildProgressAtoms.ts';
import { taskScrollTargetAtom, taskViewportRangeAtom } from '../../atoms/shapeBuildProgressAtoms.ts';
import type { BuildStage } from '@hierarchidb/components/build-stage';

const TaskProgressBar = ({
  stages,
  tasksByStage,
  stageTotals,
  buildStatus,
  activeStageId,
  resolveTaskTitle,
}: {
  stages: BuildStage[];
  tasksByStage: Record<string, TaskItemWithMetadata[]>;
  stageTotals?: TaskProgressSummary['stageTotals'];
  buildStatus: TaskProgressSummary['buildStatus'];
  activeStageId?: string | null;
  resolveTaskTitle: (task: TaskItemWithMetadata) => string;
}) => {
  const theme = useTheme();
  const filter = useBuildStageFilter();
  const flowBandClipId = useId().replace(/:/g, '');
  const setScrollTarget = useSetAtom(taskScrollTargetAtom);
  const viewportRange = useAtomValue(taskViewportRangeAtom);
  const waitingColor = theme.palette.grey[300];
  const emptyStageColor = buildStatus === 'failed' ? theme.palette.error.main : theme.palette.grey[500];
  const runningColor = theme.palette.info.main;
  const failedColor = theme.palette.error.main;
  const skippedColor = theme.palette.warning.main;
  const viewportStageId = viewportRange?.stageId;
  const viewportStartId = viewportRange?.startTaskId;
  const viewportEndId = viewportRange?.endTaskId;
  let viewportStartGlobal: number | null = null;
  let viewportEndGlobal: number | null = null;
  let viewportStartIndex: number | null = null;
  let viewportEndIndex: number | null = null;
  if (viewportStageId && viewportStartId && viewportEndId) {
    const stageTasks = tasksByStage[viewportStageId] ?? [];
    const orderedStageTasks = viewportStageId === 'vt'
      ? sortVectorTileTasks(stageTasks)
      : viewportStageId === 'transform'
        ? sortTransformTasks(stageTasks)
      : stageTasks;
    const startIndex = orderedStageTasks.findIndex((task) => task.taskId === viewportStartId);
    const endIndex = orderedStageTasks.findIndex((task) => task.taskId === viewportEndId);
    if (startIndex >= 0 && endIndex >= 0) {
      viewportStartIndex = Math.min(startIndex, endIndex);
      viewportEndIndex = Math.max(startIndex, endIndex);
    }
  }
  const successColor = theme.palette.success.main;
  const pausedColor = theme.palette.warning.main;
  const { segments, stageOffsets, stageCounts } = useMemo(() => {
    const nextSegments: Array<{ fill: string; fillOpacity: number; stageId: string; taskId?: string; title: string; width: number }> = [];
    const nextStageOffsets = new Map<string, number>();
    const nextStageCounts = new Map<string, number>();
    let totalCount = 0;
    stages.forEach((stage) => {
      const fallbackStageId = stage.id === 'transform'
        && stages.length === 1
        && (tasksByStage.transform?.length ?? 0) === 0
        && (tasksByStage.fetch?.length ?? 0) > 0
        ? 'fetch'
        : stage.id;
      const sourceStageId = fallbackStageId;
      const stageTasks = tasksByStage[sourceStageId] ?? [];
      nextStageOffsets.set(stage.id, totalCount);
      const plannedStageTotal = Math.max(0, stageTotals?.[stage.id]?.total ?? 0);
      const orderedTasks = stage.id === 'vt'
        ? sortVectorTileTasks(stageTasks)
        : stage.id === 'transform'
          ? sortTransformTasks(stageTasks)
        : stageTasks;
      const expectedStageTotal = Math.max(orderedTasks.length, plannedStageTotal);
      nextStageCounts.set(stage.id, expectedStageTotal);
      orderedTasks.forEach((task) => {
        const statusValue = (task.status ?? '').toString().toLowerCase();
        let fill = waitingColor;
        const isSkipped = isTaskSkipped(task.display, task.message);
        if (isSkipped) {
          fill = skippedColor;
        } else if (statusValue === 'completed' || statusValue === 'recycled') {
          fill = successColor;
        } else if (statusValue === 'failed') {
          fill = failedColor;
        } else if (statusValue === 'running') {
          fill = runningColor;
        } else if (statusValue === 'paused') {
          fill = pausedColor;
        }
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
    return { segments: nextSegments, stageOffsets: nextStageOffsets, stageCounts: nextStageCounts };
  }, [
    failedColor,
    pausedColor,
    filter.completedMode,
    filter.failedMode,
    filter.skippedMode,
    resolveTaskTitle,
    runningColor,
    skippedColor,
    stages,
    successColor,
    tasksByStage,
    stageTotals,
    waitingColor,
  ]);
  const viewWidth = Math.max(1, segments.reduce((total, segment) => total + segment.width, 0));
  const rectHeight = 20;
  if (viewportStageId && viewportStartIndex !== null && viewportEndIndex !== null) {
    const stageOffset = stageOffsets.get(viewportStageId);
    if (stageOffset !== undefined) {
      viewportStartGlobal = stageOffset + viewportStartIndex;
      viewportEndGlobal = stageOffset + viewportEndIndex;
    }
  }
  const outRangePaddingRatio = 0.2;
  const outRangeY = outRangePaddingRatio;
  const outRangeHeight = 1 - (outRangePaddingRatio * 2);
  const isSelfActiveStage = Boolean(
    activeStageId
    && stages.some((stage) => stage.id === activeStageId)
  );
  const showFlowBand = buildStatus === 'running' && isSelfActiveStage;
  let flowBandRange: { x: number; width: number } | null = null;
  if (showFlowBand && activeStageId) {
    const stageOffset = stageOffsets.get(activeStageId);
    const stageCount = stageCounts.get(activeStageId) ?? 0;
    if (stageOffset !== undefined && stageCount > 0) {
      flowBandRange = { x: stageOffset, width: stageCount };
    }
  }
  const flowBandWidth = viewWidth * 0.1;
  const isDraggingRef = useRef(false);
  const dragDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragDebounceMs = 80;

  const resolveTargetFromPosition = useCallback((position: number) => {
    if (segments.length === 0) return null;
    let offset = 0;
    let index = 0;
    for (const segment of segments) {
      const next = offset + segment.width;
      if (position >= offset && position < next) {
        return { segment, index };
      }
      offset = next;
      index += 1;
    }
    const lastSegment = segments[segments.length - 1];
    if (!lastSegment) return null;
    return { segment: lastSegment, index: segments.length - 1 };
  }, [segments]);

  const resolveNearestInteractiveSegment = useCallback((index: number) => {
    for (let offset = 0; offset < segments.length; offset += 1) {
      const left = index - offset;
      if (left >= 0) {
        const candidate = segments[left];
        if (candidate?.taskId) return candidate;
      }
      const right = index + offset;
      if (right < segments.length) {
        const candidate = segments[right];
        if (candidate?.taskId) return candidate;
      }
    }
    return null;
  }, [segments]);

  const updateScrollTargetFromClientX = useCallback((clientX: number, rect: DOMRect) => {
    if (!rect || rect.width <= 0 || viewWidth <= 0) return;
    const ratio = (clientX - rect.left) / rect.width;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const position = clampedRatio * viewWidth;
    const resolved = resolveTargetFromPosition(position);
    if (!resolved) return;
    const segment = resolved.segment.taskId
      ? resolved.segment
      : resolveNearestInteractiveSegment(resolved.index);
    if (!segment?.taskId) return;
    setScrollTarget({
      stageId: segment.stageId,
      taskId: segment.taskId,
      requestedAt: Date.now(),
    });
  }, [resolveNearestInteractiveSegment, resolveTargetFromPosition, setScrollTarget, viewWidth]);

  const handlePointerDown = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    event.preventDefault();
    isDraggingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateScrollTargetFromClientX(event.clientX, event.currentTarget.getBoundingClientRect());
  }, [updateScrollTargetFromClientX]);

  const handlePointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return;
    if (dragDebounceRef.current) {
      clearTimeout(dragDebounceRef.current);
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const clientX = event.clientX;
    dragDebounceRef.current = setTimeout(() => {
      dragDebounceRef.current = null;
      updateScrollTargetFromClientX(clientX, rect);
    }, dragDebounceMs);
  }, [updateScrollTargetFromClientX]);

  const handlePointerUp = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (dragDebounceRef.current) {
      clearTimeout(dragDebounceRef.current);
      dragDebounceRef.current = null;
    }
    updateScrollTargetFromClientX(event.clientX, event.currentTarget.getBoundingClientRect());
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, [updateScrollTargetFromClientX]);

  return (
    <Box
      sx={{
        width: '100%',
        height: rectHeight,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <svg
        width="100%"
        height={rectHeight}
        viewBox={`0 0 ${viewWidth} 1`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        <title>{activeStageId}</title>
        {flowBandRange ? (
          <defs>
            <clipPath id={`task-progress-flow-${flowBandClipId}`}>
              <rect
                x={flowBandRange.x}
                y={0}
                width={flowBandRange.width}
                height={1}
              />
            </clipPath>
          </defs>
        ) : null}
        {segments.length > 0 ? (() => {
          let offset = 0;
          return segments.map((segment, index) => {
            const segmentStart = offset;
            const x = segmentStart;
            const segmentEnd = segmentStart + segment.width - 1;
            const isInViewport =
              viewportStartGlobal !== null
              && viewportEndGlobal !== null
              && segmentStart <= viewportEndGlobal
              && segmentEnd >= viewportStartGlobal;
            const y = isInViewport ? 0 : outRangeY;
            const height = isInViewport ? 1 : outRangeHeight;
            offset += segment.width;
            const handleActivate = (event?: React.MouseEvent | React.KeyboardEvent) => {
              event?.preventDefault();
              if (!segment.taskId) return;
              setScrollTarget({
                stageId: segment.stageId,
                taskId: segment.taskId,
                requestedAt: Date.now(),
              });
            };
            const rect = (
              <rect
                x={x}
                y={y}
                width={segment.width}
                height={height}
                fill={segment.fill}
                fillOpacity={segment.fillOpacity}
              />
            );
            if (!segment.taskId) {
              return (
                <g key={`task-${index.toString()}`}>
                  {rect}
                  <title>{segment.title ?? 'Task segment'}</title>
                </g>
              );
            }
            return (
              <a
                key={`task-${index.toString()}`}
                href={`#task-${segment.taskId}`}
                onClick={handleActivate}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    handleActivate(event);
                  }
                }}
                aria-label={`Scroll to ${segment.stageId} task`}
                style={{ cursor: 'pointer' }}
              >
                {rect}
                <title>{segment.title ?? 'Task segment'}</title>
              </a>
            );
          });
        })() : (
          <rect
            key="task-empty"
            x={0}
            y={outRangeY}
            width={1}
            height={outRangeHeight}
            fill={emptyStageColor}
          />
        )}
        {showFlowBand && flowBandRange ? (
          <rect
            x={-flowBandWidth}
            y={0}
            width={flowBandWidth}
            height={1}
            fill="#ffffff80"
            clipPath={`url(#task-progress-flow-${flowBandClipId})`}
          >
            <animate
              attributeName="x"
              from={-flowBandWidth}
              to={viewWidth}
              dur="1.6s"
              repeatCount="indefinite"
            />
          </rect>
        ) : null}
      </svg>
    </Box>
  );
};

const BuildProgressStageContent = ({
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
}: {
  showHeader?: boolean;
  stage: BuildStage;
  stageValue: number;
  tasksByStage: Record<string, TaskItemWithMetadata[]>;
  paneProgress?: Array<{ paneId?: string; progress?: number; taskCount?: number; completedCount?: number; status?: string }>;
  isTaskSummaryLoading: boolean;
  isTasksLoading: boolean;
  resolveStatusLabel: (statusValue?: string, skipped?: boolean) => string;
  resolveStatusColor: (statusValue?: string, skipped?: boolean) => 'default' | 'success' | 'error' | 'warning' | 'info';
  resolveTaskTitle: (task: TaskItemWithMetadata) => string;
  t: (key: string, fallback: string) => string;
}) => {
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
    orderedTasks.reduce<number[]>((acc, task, index) => {
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
    && (
      viewportStartIndex == null
      || upTargetIndex < viewportStartIndex
    );
  const showDownArrow = !isScrollTargetReached
    && !hasOnlyQueuedInViewport
    && hasRunningTask
    && downTargetIndex !== null
    && currentIndex !== null
    && currentIndex < downTargetIndex
    && (
      viewportEndIndex == null
      || downTargetIndex > viewportEndIndex
    );
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

export const ShapeBuildProgressPanel = ({
  data,
  nodeId,
  onChange,
}: {
  data?: Partial<ShapeEntity>;
  nodeId?: NodeId;
  onChange?: (patch: Partial<ShapeEntity>) => void;
}) => {
  const {
    t,
    stages,
    stageProgress,
    paneProgress,
    isTasksLoading,
    isTaskSummaryLoading,
    tasksByStage,
    summary,
    controls,
    warningMessage,
    startWarning,
    crashHint,
    warningDialogOpen,
    setWarningDialogOpen,
    crashHintOpen,
    setCrashHintOpen,
    sizeWarningOpen,
    setSizeWarningOpen,
    crashSuspectMessage,
    crashSuspectOpen,
    crashSuspectControls,
    suspendSuspectMessage,
    suspendSuspectOpen,
    suspendSuspectControls,
    completionDialogOpen,
    setCompletionDialogOpen,
    completionSnapshot,
    completionStageLabel,
    completionTaskTitle,
    completionTaskMessage,
    completionReason,
    resolveTaskTitle,
    resolveStatusLabel,
    resolveStatusColor,
    controlDetails,
    stageConcurrencyIndicators,
    handleStartClick,
    handleConfirmStart,
  } = useShapeBuildProgressPanel({ data, nodeId });

  const {
    counts,
    resultCounts,
    deleteLoading,
    canDeleteFetchApiCache,
    canDeleteFetchFilteredCache,
    canDeleteTransformCache,
    canDeleteVTCache,
    canDeleteMetadata,
    handleDeleteFetchApiCache,
    handleDeleteFetchFilteredCache,
    handleDeleteTransformCache,
    handleDeleteVTCache,
    handleDeleteMetadata,
    handleResetSession,
  } = useShapeBuildCacheActions({ nodeId });

  const [isResetSessionPending, setIsResetSessionPending] = useState(false);
  const [startPendingHold, setStartPendingHold] = useState(false);
  const isResetSessionLoading = isResetSessionPending || deleteLoading.resetSession;
  const [concurrencyEditorAnchor, setConcurrencyEditorAnchor] = useState<HTMLElement | null>(null);
  const [concurrencyEditorStageId, setConcurrencyEditorStageId] = useState<'fetch' | 'transform' | 'vt' | null>(null);
  const [fetchRetryEditorAnchor, setFetchRetryEditorAnchor] = useState<HTMLElement | null>(null);
  const [startupNoticeDismissed, setStartupNoticeDismissed] = useState(false);
  const isBuildSessionStarted = controls.startPending
    || summary.buildStatus === 'running';
  const isBuildStartupPending = controls.startPending
    && summary.buildStatus !== 'running'
    && summary.buildStatus !== 'completed'
    && summary.buildStatus !== 'failed';

  const hasAnyTasks = useMemo(() => (
    stages.some((stage) => (tasksByStage[stage.id] ?? []).length > 0)
  ), [stages, tasksByStage]);
  const hasAnySummaryTasks = useMemo(() => (
    (paneProgress ?? []).some((entry) => (entry.taskCount ?? 0) > 0)
  ), [paneProgress]);
  const isTerminalStatus = summary.buildStatus === 'completed' || summary.buildStatus === 'failed';

  useEffect(() => {
    if (controls.startPending) {
      setStartupNoticeDismissed(false);
      setStartPendingHold(true);
    }
  }, [controls.startPending]);

  useEffect(() => {
    if (!startPendingHold) return;
    if (hasAnyTasks || hasAnySummaryTasks || isTerminalStatus) {
      setStartPendingHold(false);
    }
  }, [hasAnySummaryTasks, hasAnyTasks, isTerminalStatus, startPendingHold]);

  const handleStartClickWithHold = useCallback(async () => {
    setStartPendingHold(true);
    await handleStartClick();
  }, [handleStartClick]);

  const handleConfirmStartWithHold = useCallback(async () => {
    setStartPendingHold(true);
    await handleConfirmStart();
  }, [handleConfirmStart]);

  const handleResetSessionWithSkeleton = useCallback(async () => {
    if (isResetSessionLoading) return;
    setIsResetSessionPending(true);
    try {
      await handleResetSession();
    } finally {
      setIsResetSessionPending(false);
    }
  }, [handleResetSession, isResetSessionLoading]);

  const tasksByStageForDisplay = useMemo(() => {
    if (!isResetSessionLoading) return tasksByStage;
    return stages.reduce<Record<string, TaskItemWithMetadata[]>>((acc, stage) => {
      acc[stage.id] = [];
      return acc;
    }, {});
  }, [isResetSessionLoading, stages, tasksByStage]);

  const paneProgressForDisplay = useMemo(() => {
    if (!isResetSessionLoading) return paneProgress;
    return stages.map((stage) => ({
      paneId: stage.id,
      progress: 0,
      taskCount: 0,
      completedCount: 0,
      status: 'idle',
      summary: { total: 0, success: 0, error: 0, skip: 0 },
    }));
  }, [isResetSessionLoading, paneProgress, stages]);

  const stageProgressForDisplay = useMemo(() => {
    if (!isResetSessionLoading) return stageProgress;
    return stages.reduce<Record<string, number>>((acc, stage) => {
      acc[stage.id] = 0;
      return acc;
    }, {});
  }, [isResetSessionLoading, stageProgress, stages]);

  const isTaskSummaryLoadingForDisplay = isTaskSummaryLoading || isResetSessionLoading;
  const isTasksLoadingForDisplay = isTasksLoading
    || isResetSessionLoading
    || controls.startPending
    || startPendingHold;
  const startupStatusMessage = controls.statusLabel?.trim()
    || t('stage.progress.startupPending', 'Preparing build session. Please wait...');

  const processingConfigForEdit = useMemo<ShapeProcessingConfig>(() => {
    const draftConfig = data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG;
    return mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, draftConfig);
  }, [data]);
  const buildConfigForEdit = useMemo(
    () => mergeBuildConfig(DEFAULT_BUILD_CONFIG, data?.buildConfig),
    [data?.buildConfig],
  );
  const fetchRetryConfigForEdit = useMemo<DownloadRetryConfig>(() => ({
    timeoutMs: buildConfigForEdit.fetchConfig.timeoutMs,
    retryAttempts: processingConfigForEdit.fetch.retryAttempts,
    retryDelay: processingConfigForEdit.fetch.retryDelay,
    retryLimit: processingConfigForEdit.fetch.retryLimit,
    retryBackoff: processingConfigForEdit.fetch.retryBackoff,
  }), [
    buildConfigForEdit.fetchConfig.timeoutMs,
    processingConfigForEdit.fetch.retryAttempts,
    processingConfigForEdit.fetch.retryBackoff,
    processingConfigForEdit.fetch.retryDelay,
    processingConfigForEdit.fetch.retryLimit,
  ]);

  const applyProcessingConfigUpdate = useCallback((partial: Partial<ShapeProcessingConfig>) => {
    if (!onChange) return;
    const merged = mergeProcessingConfig(processingConfigForEdit, partial);
    onChange({ processingConfig: merged });
  }, [onChange, processingConfigForEdit]);
  const applyFetchRetryConfigUpdate = useCallback((next: DownloadRetryConfig) => {
    if (!onChange) return;
    const nextBuildConfig = mergeBuildConfig(buildConfigForEdit, {
      fetchConfig: {
        ...buildConfigForEdit.fetchConfig,
        timeoutMs: next.timeoutMs,
      },
    });
    const nextProcessingConfig = mergeProcessingConfig(processingConfigForEdit, {
      fetch: {
        ...processingConfigForEdit.fetch,
        retryAttempts: next.retryAttempts,
        retryDelay: next.retryDelay,
        retryLimit: next.retryLimit,
        retryBackoff: next.retryBackoff,
      },
    });
    onChange({
      buildConfig: nextBuildConfig,
      processingConfig: nextProcessingConfig,
    });
  }, [buildConfigForEdit, onChange, processingConfigForEdit]);

  const closeConcurrencyEditor = useCallback(() => {
    setConcurrencyEditorAnchor(null);
    setConcurrencyEditorStageId(null);
  }, []);

  const handleStageConcurrencyIndicatorClick = useCallback((
    stageId: string,
    event: ReactMouseEvent<HTMLElement>,
  ) => {
    if (isBuildSessionStarted) return;
    if (stageId !== 'fetch' && stageId !== 'transform' && stageId !== 'vt') return;
    setFetchRetryEditorAnchor(null);
    setConcurrencyEditorStageId(stageId);
    setConcurrencyEditorAnchor(event.currentTarget);
  }, [isBuildSessionStarted]);
  const closeFetchRetryEditor = useCallback(() => {
    setFetchRetryEditorAnchor(null);
  }, []);
  const handleFetchRetryIndicatorClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (isBuildSessionStarted) return;
    setConcurrencyEditorAnchor(null);
    setConcurrencyEditorStageId(null);
    setFetchRetryEditorAnchor(event.currentTarget);
  }, [isBuildSessionStarted]);

  useEffect(() => {
    if (!isBuildSessionStarted) return;
    setConcurrencyEditorAnchor(null);
    setConcurrencyEditorStageId(null);
    setFetchRetryEditorAnchor(null);
  }, [isBuildSessionStarted]);

  const stageConcurrencyIndicatorAriaLabels = useMemo(() => ({
    fetch: t('processing.download.workers', 'Concurrent Fetch Workers'),
    transform: t('processing.transform.workersStage1', 'Transform Workers (Simplification)'),
    vt: t('processing.tile.workers', 'Concurrent VT Workers'),
  }), [t]);
  const stageLeadingControls = useMemo(() => ({
    fetch: (
      <Tooltip title={t('processing.download.fetchRetryTitle', 'Fetch Retry')}>
        <span>
          <Button
            variant="text"
            size="small"
            aria-label={t('processing.download.fetchRetryTitle', 'Fetch Retry')}
            onClick={handleFetchRetryIndicatorClick}
            disabled={!onChange || isBuildSessionStarted}
            sx={{ minWidth: 0, px: 0.5 }}
          >
            <DownloadingIcon fontSize="small" />
          </Button>
        </span>
      </Tooltip>
    ),
  }), [handleFetchRetryIndicatorClick, isBuildSessionStarted, onChange, t]);

  const concurrencyEditorCard = useMemo(() => {
    if (!concurrencyEditorStageId) return null;
    const disabled = !onChange || isBuildSessionStarted;
    if (concurrencyEditorStageId === 'fetch') {
      return (
        <WorkerNumberConfigCard
          title={t('processing.download.workers', 'Concurrent Fetch Workers')}
          value={processingConfigForEdit.fetch.maxConcurrent}
          helperText={t('processing.download.workersHelp', 'Controls how many fetches run in parallel.')}
          warningText={undefined}
          onChange={(maxConcurrent) => {
            applyProcessingConfigUpdate({
              fetch: {
                ...processingConfigForEdit.fetch,
                maxConcurrent,
              },
            });
          }}
          min={1}
          max={4}
          step={1}
          formatLabel={(value) => t('processing.workers.countLabel', '{{count}} workers', { count: value })}
          disabled={disabled}
          disableHoverEffect
        />
      );
    }
    if (concurrencyEditorStageId === 'transform') {
      return (
        <WorkerNumberConfigCard
          title={t('processing.transform.workersStage1', 'Transform Workers (Simplification)')}
          value={processingConfigForEdit.transform.maxConcurrent}
          helperText={t(
            'processing.transform.workersStage1Help',
            'Higher concurrency can speed up processing but may exhaust browser memory.',
          )}
          warningText={undefined}
          onChange={(maxConcurrent) => {
            applyProcessingConfigUpdate({
              transform: {
                ...processingConfigForEdit.transform,
                maxConcurrent,
              },
            });
          }}
          min={1}
          max={4}
          step={1}
          formatLabel={(value) => t('processing.workers.countLabel', '{{count}} workers', { count: value })}
          disabled={disabled}
          disableHoverEffect
        />
      );
    }
    return (
      <WorkerNumberConfigCard
        title={t('processing.tile.workers', 'Concurrent VT Workers')}
        value={processingConfigForEdit.vt.maxConcurrent}
        helperText={t('processing.tile.workersHelp', 'Concurrent workers for VT generation.')}
        warningText={undefined}
        onChange={(maxConcurrent) => {
          const dynamicConcurrency = processingConfigForEdit.vt.dynamicConcurrency ?? {
            enabled: false,
            minConcurrent: maxConcurrent,
            maxConcurrent,
            highWatermark: 0.85,
            lowWatermark: 0.6,
            adjustStep: 1,
            sampleMs: 2000,
          };
          applyProcessingConfigUpdate({
            vt: {
              ...processingConfigForEdit.vt,
              maxConcurrent,
              dynamicConcurrency: {
                ...dynamicConcurrency,
                enabled: maxConcurrent >= 2,
              },
            },
          });
        }}
        min={1}
        max={8}
        step={1}
        formatLabel={(value) => t('processing.workers.countLabel', '{{count}} workers', { count: value })}
        disabled={disabled}
        disableHoverEffect
      />
    );
  }, [applyProcessingConfigUpdate, concurrencyEditorStageId, isBuildSessionStarted, onChange, processingConfigForEdit, t]);
  const fetchRetryEditorCard = useMemo(() => (
    <DownloadRetryControls
      baseRetryConfig={fetchRetryConfigForEdit}
      onChange={applyFetchRetryConfigUpdate}
      disabled={!onChange || isBuildSessionStarted}
      t={t}
      disableHoverEffect
    />
  ), [applyFetchRetryConfigUpdate, fetchRetryConfigForEdit, isBuildSessionStarted, onChange, t]);

  const stageLoadingState = useMemo(() => (
    stages.reduce<Record<string, boolean>>((acc, stage) => {
      acc[stage.id] = isResetSessionLoading;
      return acc;
    }, {})
  ), [isResetSessionLoading, stages]);

  const stageMenus = useMemo(() => {
    const menuDisabled = summary.buildStatus === 'running' || isResetSessionLoading || controls.startPending;
    const fetchApiBaseLabel = t('processing.download.deleteApiCache', 'APIキャッシュを削除');
    const fetchFilteredBaseLabel = t('processing.download.deleteFilteredCache', 'フィルター処理キャッシュを削除');
    const transformBaseLabel = t('processing.download.deleteStage1Cache', '簡略化キャッシュを削除');
    const vtBaseLabel = t('processing.download.deleteTiles', 'タイルデータを削除');
    const metadataLabel = t('processing.download.deleteMetadata', 'フィーチャーメタデータを削除');
    const resetSessionLabel = t('stage.menu.resetSession', 'Reset Session');
    const countUnit = t('processing.download.countUnit', ' items');
    const fetchApiLabel = `${fetchApiBaseLabel}(${counts.fetchApi}${countUnit})`;
    const fetchFilteredLabel = `${fetchFilteredBaseLabel}(${counts.fetchFiltered}${countUnit})`;
    const transformLabel = `${transformBaseLabel}(${counts.transform}${countUnit})`;
    const vtLabel = `${vtBaseLabel}(${counts.vt}${countUnit})`;
    const menuAriaLabel = t('stage.menu.label', 'Stage menu');

    return {
      fetch: {
        disabled: menuDisabled,
        ariaLabel: menuAriaLabel,
        items: [
          {
            id: 'fetch-api',
            label: fetchApiLabel,
            onClick: handleDeleteFetchApiCache,
            disabled: !canDeleteFetchApiCache || deleteLoading.fetchApi,
          },
          {
            id: 'fetch-filtered',
            label: fetchFilteredLabel,
            onClick: handleDeleteFetchFilteredCache,
            disabled: !canDeleteFetchFilteredCache || deleteLoading.fetchFiltered,
          },
          {
            id: 'feature-metadata',
            label: metadataLabel,
            onClick: handleDeleteMetadata,
            disabled: !canDeleteMetadata || deleteLoading.metadata || resultCounts.featureMetadata <= 0,
          },
          {
            id: 'reset-session',
            label: resetSessionLabel,
            onClick: handleResetSessionWithSkeleton,
            disabled: isResetSessionLoading,
          },
        ],
      },
      transform: {
        disabled: menuDisabled,
        ariaLabel: menuAriaLabel,
        items: [
          {
            id: 'transform',
            label: transformLabel,
            onClick: handleDeleteTransformCache,
            disabled: !canDeleteTransformCache || deleteLoading.transform,
          },
        ],
      },
      vt: {
        disabled: menuDisabled,
        ariaLabel: menuAriaLabel,
        items: [
          {
            id: 'vt',
            label: vtLabel,
            onClick: handleDeleteVTCache,
            disabled: !canDeleteVTCache || deleteLoading.vt,
          },
        ],
      },
    };
  }, [
    canDeleteFetchApiCache,
    canDeleteFetchFilteredCache,
    canDeleteMetadata,
    canDeleteTransformCache,
    canDeleteVTCache,
    counts.fetchApi,
    counts.fetchFiltered,
    counts.transform,
    counts.vt,
    deleteLoading.fetchApi,
    deleteLoading.fetchFiltered,
    deleteLoading.metadata,
    deleteLoading.transform,
    deleteLoading.vt,
    handleDeleteFetchApiCache,
    handleDeleteFetchFilteredCache,
    handleDeleteMetadata,
    handleDeleteTransformCache,
    handleDeleteVTCache,
    resultCounts.featureMetadata,
    summary.buildStatus,
    handleResetSessionWithSkeleton,
    isResetSessionLoading,
    controls.startPending,
    t,
  ]);

  const formatInlineDuration = useCallback((durationMs?: number | null) => {
    if (durationMs == null || !Number.isFinite(durationMs) || durationMs < 0) {
      return t('stage.timing.unknown', '-');
    }
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return t('stage.timing.inlineDuration', '{{hours}}h {{minutes}}m {{seconds}}s', {
      hours,
      minutes,
      seconds,
    });
  }, [t]);

  const buildTimingSummary = useCallback((stageId: string) => {
    const isTimingStage = Boolean(summary.timingStageId && summary.timingStageId === stageId);
    const completedElapsedMs = summary.completedStageElapsedMs[stageId];
    const elapsed = formatInlineDuration(
      isTimingStage ? summary.stageElapsedMs : completedElapsedMs ?? null,
    );
    const remaining = formatInlineDuration(isTimingStage ? summary.stageRemainingMs : null);
    const elapsedLabel = t('stage.timing.elapsedLabel', 'Elapsed');
    const remainingLabel = t('stage.timing.remainingLabel', 'Est. remaining');
    return (
      <Box
        display="grid"
        gridTemplateColumns="auto auto"
        columnGap={0.5}
        rowGap={0.25}
        sx={{ textAlign: 'right', justifyContent: 'end', alignItems: 'center' }}
      >
        <Box display="flex" alignItems="center" justifyContent="flex-end">
          <TimelapseIcon
            sx={{ fontSize: 14, color: 'text.secondary' }}
            titleAccess={elapsedLabel}
          />
        </Box>
        <Typography variant="caption" color="text.primary">
          {elapsed}
        </Typography>
        <Box display="flex" alignItems="center" justifyContent="flex-end">
          <HourglassTopIcon
            sx={{ fontSize: 14, color: 'text.secondary' }}
            titleAccess={remainingLabel}
          />
        </Box>
        <Typography variant="caption" color="text.primary">
          {remaining}
        </Typography>
      </Box>
    );
  }, [
    formatInlineDuration,
    summary.completedStageElapsedMs,
    summary.stageElapsedMs,
    summary.stageRemainingMs,
    summary.timingStageId,
    t,
  ]);

  const stageHeaderMeta = useMemo(() => (
    stages.reduce<Record<string, ReactNode>>((acc, stage) => {
      acc[stage.id] = buildTimingSummary(stage.id);
      return acc;
    }, {})
  ), [buildTimingSummary, stages]);

  const stageProgressContent = useMemo(() => (
    stages.reduce<Record<string, JSX.Element>>((acc, stage) => {
      const stageTasks = tasksByStageForDisplay[stage.id] ?? [];
      acc[stage.id] = (
        <Stack gap={1}>
          <TaskProgressBar
            stages={[stage]}
            tasksByStage={{ [stage.id]: stageTasks }}
            stageTotals={summary.stageTotals}
            buildStatus={summary.buildStatus}
            activeStageId={summary.timingStageId ?? null}
            resolveTaskTitle={resolveTaskTitle}
          />
        </Stack>
      );
      return acc;
    }, {})
  ), [resolveTaskTitle, stages, summary.buildStatus, summary.stageTotals, summary.timingStageId, tasksByStageForDisplay]);

  const stageContents = useMemo(() => (
    stages.reduce<Record<string, JSX.Element>>((acc, stage) => {
      acc[stage.id] = (
        <BuildProgressStageContent
          stage={stage}
          stageValue={stageProgressForDisplay[stage.id] ?? 0}
          tasksByStage={tasksByStageForDisplay}
          paneProgress={paneProgressForDisplay ?? []}
          isTasksLoading={isTasksLoadingForDisplay}
          isTaskSummaryLoading={isTaskSummaryLoadingForDisplay}
          resolveStatusLabel={resolveStatusLabel}
          resolveStatusColor={resolveStatusColor}
          resolveTaskTitle={resolveTaskTitle}
          t={t}
          showHeader={false}
        />
      );
      return acc;
    }, {})
  ), [
    isTaskSummaryLoadingForDisplay,
    isTasksLoadingForDisplay,
    paneProgressForDisplay,
    resolveStatusColor,
    resolveStatusLabel,
    resolveTaskTitle,
    stageProgressForDisplay,
    stages,
    t,
    tasksByStageForDisplay,
  ]);

  return (
    <BuildSessionProgressPanel
      status={summary.buildStatus}
      overallProgress={summary.overallProgress}
      stages={stages}
      stageProgress={stageProgressForDisplay}
      paneProgress={paneProgressForDisplay}
      stageLoadingState={stageLoadingState}
      splitViewBreakpoints={[600, 900, 1200]}
      splitViewInitialSizesByBreakpoint={[
        Array.from({ length: stages.length }, () => 250),
        Array.from({ length: stages.length }, () => 250),
        Array.from({ length: stages.length }, () => 250),
        Array.from({ length: stages.length }, () => 250),
      ]}
      splitViewAutoCloseCountsByBreakpoint={[
        Math.max(0, stages.length - 1),
        Math.max(0, stages.length - 2),
        Math.max(0, stages.length - 3),
        0,
      ]}
      stageContents={stageContents}
      stageProgressContent={stageProgressContent}
      stageConcurrencyIndicators={stageConcurrencyIndicators}
      onStageConcurrencyIndicatorClick={isBuildSessionStarted ? undefined : handleStageConcurrencyIndicatorClick}
      stageConcurrencyIndicatorAriaLabels={stageConcurrencyIndicatorAriaLabels}
      stageLeadingControls={stageLeadingControls}
      stageMenus={stageMenus}
      stageHeaderMeta={stageHeaderMeta}
      chipPlacement="belowProgress"
      suppressStatusFallback
      startIcon={<ConstructionIcon fontSize="small" />}
      onResume={controls.canStartOrResume ? handleStartClickWithHold : undefined}
      onPause={controls.pausePending ? undefined : controls.handlePause}
      controlLabel={t('stage.controls.title', 'Build controls')}
      pauseLabel={t('stage.controls.pause', 'Pause')}
      pauseLoading={false}
      pausePending={controls.pausePending}
      startPending={controls.startPending}
      showResumeLabel={controls.showResumeLabel}
      startLabel={t('stage.controls.start', 'Start Build')}
      resumeLabel={t('stage.controls.resume', 'Resume Build')}
      statusLabel={controls.statusLabel}
      controlDetails={controlDetails}
      controlRightContent={(
        <BuildSessionLauncherPanel nodeType={toNodeType('shape')} excludeNodeId={nodeId} />
      )}
      suspendDialog={{
        open: suspendSuspectOpen,
        onClose: () => suspendSuspectControls.close(),
        title: t('stage.progress.suspendSuspectTitle', 'Build tab suspended'),
        message: suspendSuspectMessage ?? t('stage.progress.suspendSuspect', 'Build is paused while another tab is in background.'),
        closeLabel: t('common.close', 'Close'),
      }}
      crashDialog={{
        open: crashSuspectOpen,
        onClose: () => crashSuspectControls.close(),
        title: t('stage.progress.crashSuspectTitle', 'Build may have stopped'),
        message: crashSuspectMessage ?? t('stage.progress.crashSuspect', 'Build session may have stopped unexpectedly.'),
        closeLabel: t('common.close', 'Close'),
      }}
      completionDialog={{
        open: completionDialogOpen,
        onClose: () => setCompletionDialogOpen(false),
        closeLabel: t('common.close', 'Close'),
        title: completionSnapshot?.status === 'completed'
          ? t('stage.progress.completedTitle', 'Build completed')
          : t('stage.progress.failedTitle', 'Build failed'),
        content: (
          <>
            <Typography variant="body2">
              {t('stage.progress.completedStageLabel', 'Stage')}: {completionSnapshot?.stageLabel ?? completionStageLabel}
            </Typography>
            {completionSnapshot?.status === 'failed' ? (
              <>
                <Typography variant="body2">
                  {t('stage.progress.failedTaskLabel', 'Task')}: {completionSnapshot?.taskTitle ?? completionTaskTitle}
                </Typography>
                <Typography variant="body2">
                  {t('stage.progress.failedMessageLabel', 'Message')}: {completionSnapshot?.taskMessage ?? completionTaskMessage}
                </Typography>
              </>
            ) : (
              <Typography variant="body2">
                {t('stage.progress.completedReasonLabel', 'Reason')}: {completionSnapshot?.reason ?? completionReason}
              </Typography>
            )}
          </>
        ),
      }}
      footer={(
        <>
          <Popover
            open={Boolean(fetchRetryEditorAnchor)}
            anchorEl={fetchRetryEditorAnchor}
            onClose={closeFetchRetryEditor}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            <Box sx={{ p: 2, width: 820, maxWidth: 'calc(100vw - 24px)' }}>
              {fetchRetryEditorCard}
            </Box>
          </Popover>
          <Popover
            open={Boolean(concurrencyEditorAnchor && concurrencyEditorStageId)}
            anchorEl={concurrencyEditorAnchor}
            onClose={closeConcurrencyEditor}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            <Box sx={{ p: 2, width: 360, maxWidth: 'calc(100vw - 24px)' }}>
              {concurrencyEditorCard}
            </Box>
          </Popover>
          <Snackbar
            open={isBuildStartupPending && !startupNoticeDismissed}
            onClose={(_event, reason) => {
              if (reason === 'clickaway') return;
              setStartupNoticeDismissed(true);
            }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity="info" variant="filled" onClose={() => setStartupNoticeDismissed(true)}>
              {startupStatusMessage}
            </Alert>
          </Snackbar>
          <Snackbar
            open={crashHintOpen}
            autoHideDuration={8000}
            onClose={() => setCrashHintOpen(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity="warning" variant="filled" onClose={() => setCrashHintOpen(false)}>
              {crashHint}
            </Alert>
          </Snackbar>
          <Snackbar
            open={sizeWarningOpen}
            autoHideDuration={8000}
            onClose={() => setSizeWarningOpen(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity="warning" variant="filled" onClose={() => setSizeWarningOpen(false)}>
              {warningMessage}
            </Alert>
          </Snackbar>
          {startWarning ? (
            <Dialog open={warningDialogOpen} onClose={() => setWarningDialogOpen(false)}>
              <DialogTitle>{startWarning.title}</DialogTitle>
              <DialogContent>
                <Typography variant="body2" color="text.secondary">
                  {startWarning.message}
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setWarningDialogOpen(false)}>
                  {t('stage.warning.cancel', 'Cancel')}
                </Button>
                <Button variant="contained" onClick={handleConfirmStartWithHold}>
                  {t('stage.warning.proceed', 'Proceed')}
                </Button>
              </DialogActions>
            </Dialog>
          ) : null}
        </>
      )}
    />
  );
};
