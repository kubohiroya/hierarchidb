import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { Box, useTheme } from '@mui/material';
import { useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useId, useRef } from 'react';

import type {
  TaskWithMetadata,
} from './TaskListVirtualized.tsx';
import { isSkippedMessage, sortVectorTileTasks } from './TaskListVirtualized.tsx';
import type { TaskProgressSummary } from '../../atoms/shapeBuildProgressAtoms.ts';
import { taskScrollTargetAtom, taskViewportRangeAtom } from '../../atoms/shapeBuildProgressAtoms.ts';
import type { BuildStage } from '@hierarchidb/components';

type TaskProgressBarProps = {
  stages: BuildStage[];
  tasksByStage: Record<string, TaskWithMetadata[]>;
  buildStatus: TaskProgressSummary['buildStatus'];
  activeStageId?: string | null;
  resolveTaskTitle: (task: TaskWithMetadata) => string;
};
export const TaskProgressBar = ({
  stages,
  tasksByStage,
  buildStatus,
  activeStageId,
  resolveTaskTitle,
}: TaskProgressBarProps) => {
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
  const segments: Array<{ fill: string; stageId: string; taskId?: string; title: string; width: number }> = [];
  const stageOffsets = new Map<string, number>();
  const stageCounts = new Map<string, number>();
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
    stageOffsets.set(stage.id, totalCount);
    if (stageTasks.length === 0) {
      stageCounts.set(stage.id, 0);
      return;
    }
    const orderedTasks = stage.id === 'vt'
      ? sortVectorTileTasks(stageTasks)
      : stageTasks;
    stageCounts.set(stage.id, orderedTasks.length);
    orderedTasks.forEach((task) => {
      const statusValue = (task.status ?? '').toString().toLowerCase();
      let fill = waitingColor;
      const isSkipped = isSkippedMessage(task.message);
      if (isSkipped) {
        fill = skippedColor;
      } else if (statusValue === 'completed') {
        fill = theme.palette.success.main;
      } else if (statusValue === 'failed') {
        fill = failedColor;
      } else if (statusValue === 'running') {
        fill = runningColor;
      } else if (statusValue === 'paused') {
        fill = theme.palette.warning.main;
      }
      const isExternalStage = sourceStageId !== stage.id;
      segments.push({
        fill,
        stageId: stage.id,
        taskId: isExternalStage ? undefined : task.taskId,
        title: resolveTaskTitle(task),
        width: 1,
      });
      totalCount += 1;
    });
  });

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

  const handlePointerDown = useCallback((event: PointerEvent<SVGSVGElement>) => {
    event.preventDefault();
    isDraggingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateScrollTargetFromClientX(event.clientX, event.currentTarget.getBoundingClientRect());
  }, [updateScrollTargetFromClientX]);

  const handlePointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
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
  }, [dragDebounceMs, updateScrollTargetFromClientX]);

  const handlePointerUp = useCallback((event: PointerEvent<SVGSVGElement>) => {
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
            const handleActivate = (event?: MouseEvent | KeyboardEvent) => {
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
                  <title>{segment.title}</title>
                </g>
              );
            }
            return (
              <a
                key={`task-${index.toString()}`}
                href="#"
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
                <title>{segment.title}</title>
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
