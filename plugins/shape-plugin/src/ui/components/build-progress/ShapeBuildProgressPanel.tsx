import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import TimelapseIcon from '@mui/icons-material/Timelapse';
import { type NodeId, toNodeType } from '@hierarchidb/core-types';
import { BuildSessionProgressPanel, useBuildStageFilter } from '@hierarchidb/components';
import { BuildSessionLauncherPanel } from '@hierarchidb/ui-batch-progress';
import { useAtomValue, useSetAtom } from 'jotai';
import type { TaskWithMetadata } from './TaskListVirtualized.tsx';
import { TaskListVirtualized, sortTransformTasks, sortVectorTileTasks } from './TaskListVirtualized.tsx';
import type { ShapeEntity } from '../../../common/types/ShapeEntity.ts';
import { isSkippedMessage } from '../../../common/utils/taskMessages.ts';
import { useShapeBuildProgressPanel } from './useShapeBuildProgressPanel.ts';
import { useShapeBuildCacheActions } from '../build-config/useShapeBuildCacheActions.ts';
import type { TaskProgressSummary } from '../../atoms/shapeBuildProgressAtoms.ts';
import { taskScrollTargetAtom, taskViewportRangeAtom } from '../../atoms/shapeBuildProgressAtoms.ts';
import type { BuildStage } from '@hierarchidb/components';

const TaskProgressBar = ({
  stages,
  tasksByStage,
  buildStatus,
  activeStageId,
  resolveTaskTitle,
}: {
  stages: BuildStage[];
  tasksByStage: Record<string, TaskWithMetadata[]>;
  buildStatus: TaskProgressSummary['buildStatus'];
  activeStageId?: string | null;
  resolveTaskTitle: (task: TaskWithMetadata) => string;
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
      if (stageTasks.length === 0) {
        nextStageCounts.set(stage.id, 0);
        return;
      }
      const orderedTasks = stage.id === 'vt'
        ? sortVectorTileTasks(stageTasks)
        : stage.id === 'transform'
          ? sortTransformTasks(stageTasks)
        : stageTasks;
      nextStageCounts.set(stage.id, orderedTasks.length);
      orderedTasks.forEach((task) => {
        const statusValue = (task.status ?? '').toString().toLowerCase();
        let fill = waitingColor;
        const isSkipped = isSkippedMessage(task.message);
        if (isSkipped) {
          fill = skippedColor;
        } else if (statusValue === 'completed') {
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
          || (statusValue === 'completed' && !filter.completedMode);
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
  const showFlowBand = buildStatus === 'running' && Boolean(activeStageId);
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
          let globalIndex = 0;
          return segments.map((segment, index) => {
            const x = offset;
            const isInViewport =
              viewportStartGlobal !== null
              && viewportEndGlobal !== null
              && globalIndex >= viewportStartGlobal
              && globalIndex <= viewportEndGlobal;
            const y = isInViewport ? 0 : outRangeY;
            const height = isInViewport ? 1 : outRangeHeight;
            offset += segment.width;
            globalIndex += 1;
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
  tasksByStage: Record<string, TaskWithMetadata[]>;
  paneProgress?: Array<{ paneId?: string; progress?: number; taskCount?: number; completedCount?: number; status?: string }>;
  isTaskSummaryLoading: boolean;
  isTasksLoading: boolean;
  resolveStatusLabel: (statusValue?: string, skipped?: boolean) => string;
  resolveStatusColor: (statusValue?: string, skipped?: boolean) => 'default' | 'success' | 'error' | 'warning' | 'info';
  resolveTaskTitle: (task: TaskWithMetadata) => string;
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
    if (isSkippedMessage(task.message)) return filter.skippedMode;
    if (task.status === 'failed') return filter.failedMode;
    if (task.status === 'completed') return filter.completedMode;
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
  const showTaskSkeleton = !hasTasks && !showSummarySkeleton && (isTasksLoading || hasSummaryTasks);
  const runningTargetIndex = useMemo(() => {
    for (let i = orderedTasks.length - 1; i >= 0; i -= 1) {
      const task = orderedTasks[i];
      if (!task) continue;
      if (task.status === 'running') return i;
    }
    return null;
  }, [orderedTasks]);
  const runningTaskId = runningTargetIndex === null ? undefined : orderedTasks[runningTargetIndex]?.taskId;
  const isRunningVisible = runningTargetIndex !== null
    && viewportRange?.stageId === stage.id
    && runningTargetIndex >= viewportRange.startIndex
    && runningTargetIndex <= viewportRange.endIndex;
  const shouldShowScrollButton = Boolean(runningTaskId) && !isRunningVisible;
  const scrollDirection: 'up' | 'down' | null = useMemo(() => {
    if (!shouldShowScrollButton || runningTargetIndex === null) return null;
    if (viewportRange?.stageId !== stage.id || viewportRange == null) return 'down';
    if (runningTargetIndex < viewportRange.startIndex) return 'up';
    if (runningTargetIndex > viewportRange.endIndex) return 'down';
    return null;
  }, [runningTargetIndex, shouldShowScrollButton, stage.id, viewportRange]);
  const handleScrollToRunning = useCallback(() => {
    if (!runningTaskId) return;
    setScrollTarget({
      stageId: stage.id,
      taskId: runningTaskId,
      requestedAt: Date.now(),
    });
  }, [runningTaskId, setScrollTarget, stage.id]);
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
      ) : showTaskSkeleton ? showHeader && (
            <Typography variant="subtitle2">{stage.title}</Typography>
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
          <TaskListVirtualized
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
          {scrollDirection ? (
            <Tooltip title={t('stage.progress.scrollToRunning', 'Scroll to running task')}>
              <IconButton
                aria-label={t('stage.progress.scrollToRunning', 'Scroll to running task')}
                color="primary"
                onClick={handleScrollToRunning}
                sx={{
                  position: 'absolute',
                  left: '50%',
                  ...(scrollDirection === 'down' ? { bottom: 0 } : { top: 0 }),
                  transform: 'translateX(-50%)',
                  bgcolor: 'transparent',
                  boxShadow: 'none',
                  zIndex: 2,
                  width: 56,
                  height: 56,
                  '&:hover': { bgcolor: 'transparent' },
                }}
              >
                {scrollDirection === 'down'
                  ? <ArrowCircleDownIcon sx={{ fontSize: 48 }} />
                  : <ArrowCircleUpIcon sx={{ fontSize: 48 }} />}
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
    activeStageId,
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
    stageProgressItems,
    stageContentItems,
  } = useShapeBuildProgressPanel({ data, nodeId });

  const resetSessionDraft = useCallback(() => {
    onChange?.({
      ...(data ?? {}),
      processingStatus: 'idle',
      buildStartedAt: undefined,
      buildFinishedAt: undefined,
      buildElapsedMs: 0,
      buildResumedAt: undefined,
      stageElapsedMs: 0,
      stageResumedAt: undefined,
      stageElapsedStageId: undefined,
      stageElapsedByStage: {},
    });
  }, [data, onChange]);

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
  } = useShapeBuildCacheActions({ nodeId, draft: data, onResetSession: resetSessionDraft });

  const stageMenus = useMemo(() => {
    const menuDisabled = summary.buildStatus === 'running';
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
            onClick: handleResetSession,
            disabled: deleteLoading.resetSession,
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
    const persistedCompletedElapsedMs = data?.stageElapsedByStage?.[stageId];
    const completedElapsedMs = summary.completedStageElapsedMs[stageId] ?? persistedCompletedElapsedMs;
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
    data?.stageElapsedByStage,
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
    stageProgressItems.reduce<Record<string, JSX.Element>>((acc, item) => {
      const stage = item.stage;
      acc[stage.id] = (
        <Stack gap={1}>
          <TaskProgressBar
            stages={[stage]}
            tasksByStage={{ [stage.id]: item.tasks }}
            buildStatus={summary.buildStatus}
            activeStageId={activeStageId}
            resolveTaskTitle={resolveTaskTitle}
          />
        </Stack>
      );
      return acc;
    }, {})
  ), [activeStageId, stageProgressItems, summary.buildStatus, resolveTaskTitle]);

  const stageContents = useMemo(() => (
    stageContentItems.reduce<Record<string, JSX.Element>>((acc, item) => {
      const stage = item.stage;
      acc[stage.id] = (
        <BuildProgressStageContent
          stage={stage}
          stageValue={item.stageValue}
          tasksByStage={tasksByStage}
          paneProgress={paneProgress ?? []}
          isTasksLoading={isTasksLoading}
          isTaskSummaryLoading={isTaskSummaryLoading}
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
    stageContentItems,
    paneProgress,
    resolveStatusColor,
    resolveStatusLabel,
    resolveTaskTitle,
    t,
    tasksByStage,
    isTasksLoading,
    isTaskSummaryLoading,
  ]);

  return (
    <BuildSessionProgressPanel
      status={summary.buildStatus}
      overallProgress={summary.overallProgress}
      stages={stages}
      stageProgress={stageProgress}
      paneProgress={paneProgress}
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
      stageMenus={stageMenus}
      stageHeaderMeta={stageHeaderMeta}
      chipPlacement="belowProgress"
      suppressStatusFallback
      startIcon={<ConstructionIcon fontSize="small" />}
      onResume={controls.canStartOrResume ? handleStartClick : undefined}
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
          <Snackbar
            open={crashHintOpen}
            autoHideDuration={8000}
            onClose={() => setCrashHintOpen(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          >
            <Alert severity="warning" variant="filled" onClose={() => setCrashHintOpen(false)}>
              {crashHint}
            </Alert>
          </Snackbar>
          <Snackbar
            open={sizeWarningOpen}
            autoHideDuration={8000}
            onClose={() => setSizeWarningOpen(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
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
                <Button variant="contained" onClick={handleConfirmStart}>
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
