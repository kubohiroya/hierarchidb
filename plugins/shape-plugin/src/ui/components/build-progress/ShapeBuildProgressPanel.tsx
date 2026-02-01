import { useCallback, useId, useMemo, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import type { NodeId } from '@hierarchidb/core-types';
import { BuildProgressPanel, useBuildStageFilter } from '@hierarchidb/components';
import { useAtomValue, useSetAtom } from 'jotai';
import type { TaskWithMetadata } from './TaskListVirtualized.tsx';
import { TaskListVirtualized, sortVectorTileTasks } from './TaskListVirtualized.tsx';
import type { ShapeEntity } from '../../../common/types/ShapeEntity.ts';
import { isSkippedMessage } from '../../../common/utils/taskMessages.ts';
import { useShapeBuildProgressPanel } from './useShapeBuildProgressPanel.ts';
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
    const nextSegments: Array<{ fill: string; stageId: string; taskId?: string; title: string; width: number }> = [];
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
        const isExternalStage = sourceStageId !== stage.id;
        nextSegments.push({
          fill,
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
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
                width={Math.ceil(segment.width) + 2}
                height={height}
                fill={segment.fill}
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

const TaskProgressSummaryCard = ({
  summary,
  stages,
  tasksByStage,
  activeStageId,
  resolveTaskTitle,
  t,
}: {
  summary: TaskProgressSummary;
  stages: BuildStage[];
  tasksByStage: Record<string, TaskWithMetadata[]>;
  activeStageId?: string | null;
  resolveTaskTitle: (task: TaskWithMetadata) => string;
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string;
}) => (
  <Card
    variant="outlined"
    sx={{
      width: '100%',
      transition: 'none',
      '&:hover': { transform: 'none', boxShadow: 'none' },
    }}
    data-testid="shape-plugin-batch-progress-summary"
  >
    <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
        <Stack spacing={0.25} flex={1}>
          <Typography variant="caption" color="text.secondary">
            {t('stage.progress.stage', 'Stage')}
          </Typography>
          <Typography variant="body2">{summary.stageLabel}</Typography>
        </Stack>
        <Stack spacing={0.25} flex={1}>
          <Typography variant="caption" color="text.secondary">
            {summary.taskUnitLabel || t('stage.progress.task', 'Polygons')}
          </Typography>
          <Typography variant="body2">{summary.taskLabel}</Typography>
        </Stack>
      </Stack>
      <Stack gap={1}>
        <TaskProgressBar
          stages={stages}
          tasksByStage={tasksByStage}
          buildStatus={summary.buildStatus}
          activeStageId={activeStageId}
          resolveTaskTitle={resolveTaskTitle}
        />
        <Typography variant="caption" color="text.secondary">
          {t('stage.progress.countsWithUnit', '{{percentage}}% ・ {{completed}}/{{total}} {{unit}} completed ・ failed {{failed}} ・ skipped {{skipped}}', {
            percentage: Math.round(summary.overallProgress),
            completed: summary.completed,
            total: summary.total,
            failed: summary.failed,
            skipped: summary.skipped,
            unit: summary.taskUnitLabel || t('stage.progress.task', 'Polygons'),
          })}
        </Typography>
      </Stack>
    </CardContent>
  </Card>
);

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
  const displayTasks = stage.id === 'vt'
    ? sortVectorTileTasks(filteredTasks)
    : filteredTasks;
  const hasTasks = filteredTasks.length > 0;
  const stagePane = paneProgress?.find((entry) => entry.paneId === stage.id);
  const hasSummaryTasks = (stagePane?.taskCount ?? 0) > 0;
  const showSummarySkeleton = isTaskSummaryLoading && !hasTasks && !hasSummaryTasks;
  const showTaskSkeleton = !hasTasks && !showSummarySkeleton && (isTasksLoading || hasSummaryTasks);

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
          {showHeader ? (
            <Typography variant="subtitle2">{stage.title}</Typography>
          ) : null}
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="rounded" height={160} />
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
        <TaskListVirtualized
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
      )}
    </Stack>
  );
};

export const ShapeBuildProgressPanel = ({ data, nodeId }: { data?: Partial<ShapeEntity>; nodeId?: NodeId }) => {
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
    <BuildProgressPanel
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
      statusContent={summary.hasProgressData ? (
        <TaskProgressSummaryCard
          summary={summary}
          stages={stages}
          tasksByStage={tasksByStage}
          activeStageId={activeStageId}
          resolveTaskTitle={resolveTaskTitle as (task: TaskWithMetadata) => string}
          t={t}
        />
      ) : undefined}
      startIcon={<ConstructionIcon fontSize="small" />}
      onResume={controls.canStartOrResume ? handleStartClick : undefined}
      onPause={controls.handlePause}
      controlLabel={t('stage.controls.title', 'Build controls')}
      pauseLabel={t('stage.controls.pause', 'Pause')}
      startLabel={t('stage.controls.start', 'Start Build')}
      resumeLabel={t('stage.controls.resume', 'Resume Build')}
      statusLabel={controls.statusLabel}
      controlDetails={controlDetails}
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
          <Dialog
            open={completionDialogOpen}
            onClose={() => setCompletionDialogOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              {completionSnapshot?.status === 'completed'
                ? t('stage.progress.completedTitle', 'Build completed')
                : t('stage.progress.failedTitle', 'Build failed')}
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setCompletionDialogOpen(false)} variant="contained">
                {t('common.close', 'Close')}
              </Button>
            </DialogActions>
          </Dialog>
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
