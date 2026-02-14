import { type CSSProperties, type MutableRefObject, forwardRef, useCallback, useEffect, useMemo, useRef } from 'react';
import { Box } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import RecyclingIcon from '@mui/icons-material/Recycling';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSetAtom } from 'jotai';
import type { ShapeBuildTaskSummary } from '../../atoms/shapeBuildProgressAtoms.js';
import { isTaskPhaseMessage, isTaskSkipped } from '../../../common/utils/taskMessages.ts';
import { taskViewportRangeAtom } from '../../atoms/shapeBuildProgressAtoms.js';
import { TaskItem, TASK_ITEM_HEIGHT } from './TaskItem.tsx';
import { formatGeometrySimplifySummary, parseGeometrySimplifyError } from './geometrySimplifyError.ts';
import { formatTaskDisplayMessage } from './taskDisplayText.ts';
import { useTranslation } from '../../i18n.js';

export type TaskWithMetadata = ShapeBuildTaskSummary & { title?: string };

type TaskListProps = {
  stageId: string;
  tasks: ShapeBuildTaskSummary[];
  stageValue: number;
  resolveStatusLabel: (statusValue?: string, skipped?: boolean) => string;
  resolveStatusColor: (statusValue?: string, skipped?: boolean) => 'default' | 'success' | 'error' | 'warning' | 'info';
  resolveTaskTitle: (task: TaskWithMetadata) => string;
  scrollToTaskId?: string;
  scrollRequestId?: number;
  virtualize?: boolean;
};

const getVectorTileCoordsFromTitle = (task: ShapeBuildTaskSummary): { z: number; x: number; y: number } | null => {
  const title = (task as TaskWithMetadata).title;
  if (!title) return null;
  const match = title.match(/z\s*(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/i);
  if (!match) return null;
  const z = Number.parseInt(match[1] ?? '', 10);
  const x = Number.parseInt(match[2] ?? '', 10);
  const y = Number.parseInt(match[3] ?? '', 10);
  if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { z, x, y };
};

export const sortVectorTileTasks = (tasks: ShapeBuildTaskSummary[]): ShapeBuildTaskSummary[] => {
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    const aCoord = getVectorTileCoordsFromTitle(a);
    const bCoord = getVectorTileCoordsFromTitle(b);
    if (aCoord && bCoord) {
      if (aCoord.z !== bCoord.z) return aCoord.z - bCoord.z;
      if (aCoord.x !== bCoord.x) return aCoord.x - bCoord.x;
      if (aCoord.y !== bCoord.y) return aCoord.y - bCoord.y;
      return a.taskId.localeCompare(b.taskId);
    }
    if (aCoord) return -1;
    if (bCoord) return 1;
    return a.taskId.localeCompare(b.taskId);
  });
  return sorted;
};

export const sortTransformTasks = (tasks: ShapeBuildTaskSummary[]): ShapeBuildTaskSummary[] => {
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    const pa = typeof a.stagePriority === 'number' ? a.stagePriority : Number.POSITIVE_INFINITY;
    const pb = typeof b.stagePriority === 'number' ? b.stagePriority : Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    const ia = typeof a.index === 'number' ? a.index : Number.POSITIVE_INFINITY;
    const ib = typeof b.index === 'number' ? b.index : Number.POSITIVE_INFINITY;
    if (ia !== ib) return ia - ib;
    return a.taskId.localeCompare(b.taskId);
  });
  return sorted;
};

export const TaskListVirtualized = forwardRef<HTMLDivElement, TaskListProps>(({
  stageId,
  tasks,
  stageValue,
  resolveStatusLabel,
  resolveStatusColor,
  resolveTaskTitle,
  scrollToTaskId,
  scrollRequestId,
  virtualize = true,
}: TaskListProps, ref) => {
  const { t } = useTranslation();
  const shouldVirtualize = virtualize;
  const parentRef = useRef<HTMLDivElement | null>(null);
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    parentRef.current = node;
    if (!ref) return;
    if (typeof ref === 'function') {
      ref(node);
      return;
    }
    (ref as MutableRefObject<HTMLDivElement | null>).current = node;
  }, [ref]);
  const setViewportRange = useSetAtom(taskViewportRangeAtom);
  const lastScrollRequestRef = useRef<number | null>(null);
  const lastViewportRef = useRef<{
    stageId: string;
    startIndex: number;
    endIndex: number;
    startTaskId: string;
    endTaskId: string;
    total: number;
  } | null>(null);
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => TASK_ITEM_HEIGHT,
    overscan: 8,
  });
  const orderedTasks = useMemo(() => {
    if (stageId === 'vt') return sortVectorTileTasks(tasks);
    if (stageId === 'transform') return sortTransformTasks(tasks);
    return tasks;
  }, [stageId, tasks]);
  useEffect(() => {
    if (!shouldVirtualize) return;
    if (!scrollToTaskId || scrollRequestId == null) return;
    const index = orderedTasks.findIndex((task) => task.taskId === scrollToTaskId);
    if (index < 0) return;
    if (lastScrollRequestRef.current === scrollRequestId) return;
    lastScrollRequestRef.current = scrollRequestId;
    window.requestAnimationFrame(() => virtualizer.scrollToIndex(index, { align: 'center' }));
  }, [scrollRequestId, scrollToTaskId, shouldVirtualize, orderedTasks, virtualizer]);

  useEffect(() => {
    if (!shouldVirtualize) return;
    const scrollEl = parentRef.current;
    if (!scrollEl) return;
    const updateViewport = () => {
      if (tasks.length === 0) {
        setViewportRange((prev) => (prev && prev.stageId === stageId ? null : prev));
        lastViewportRef.current = null;
        return;
      }
      const viewportHeight = scrollEl.clientHeight;
      const scrollTop = scrollEl.scrollTop;
      const total = orderedTasks.length;
      if (total === 0 || viewportHeight <= 0) return;
      const startIndex = Math.min(Math.max(Math.floor(scrollTop / TASK_ITEM_HEIGHT), 0), total - 1);
      const endIndex = Math.min(
        Math.max(Math.floor((scrollTop + viewportHeight - 1) / TASK_ITEM_HEIGHT), startIndex),
        total - 1,
      );
      const startTaskId = orderedTasks[startIndex]?.taskId ?? '';
      const endTaskId = orderedTasks[endIndex]?.taskId ?? startTaskId;
      if (!startTaskId || !endTaskId) return;
      const next = {
        stageId,
        startIndex,
        endIndex,
        startTaskId,
        endTaskId,
        total,
      };
      const prev = lastViewportRef.current;
      if (
        prev
        && prev.stageId === next.stageId
        && prev.startIndex === next.startIndex
        && prev.endIndex === next.endIndex
        && prev.startTaskId === next.startTaskId
        && prev.endTaskId === next.endTaskId
        && prev.total === next.total
      ) {
        return;
      }
      lastViewportRef.current = next;
      setViewportRange({
        ...next,
        updatedAt: Date.now(),
      });
    };
    updateViewport();
    const handleScroll = () => {
      window.requestAnimationFrame(updateViewport);
    };
    scrollEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener('scroll', handleScroll);
    };
  }, [setViewportRange, shouldVirtualize, stageId, orderedTasks, tasks.length]);

  useEffect(() => {
    if (shouldVirtualize) return;
    if (tasks.length === 0) {
      setViewportRange((prev) => (prev && prev.stageId === stageId ? null : prev));
      lastViewportRef.current = null;
      return;
    }
    const startIndex = 0;
    const endIndex = orderedTasks.length - 1;
    const startTaskId = orderedTasks[startIndex]?.taskId ?? '';
    const endTaskId = orderedTasks[endIndex]?.taskId ?? startTaskId;
    if (!startTaskId || !endTaskId) return;
    const next = {
      stageId,
      startIndex,
      endIndex,
      startTaskId,
      endTaskId,
      total: orderedTasks.length,
    };
    const prev = lastViewportRef.current;
    if (
      prev
      && prev.stageId === next.stageId
      && prev.startIndex === next.startIndex
      && prev.endIndex === next.endIndex
      && prev.startTaskId === next.startTaskId
      && prev.endTaskId === next.endTaskId
      && prev.total === next.total
    ) {
      return;
    }
    lastViewportRef.current = next;
    setViewportRange({
      ...next,
      updatedAt: Date.now(),
    });
  }, [setViewportRange, shouldVirtualize, stageId, orderedTasks, tasks.length]);

  const renderTaskItem = useCallback((task: ShapeBuildTaskSummary, key: string, style?: CSSProperties) => {
    const statusValue = task.status;
    const isSkipped = isTaskSkipped(task.display, task.message);
    const displayProgress = Math.min(100, Math.max(0, task.progress ?? stageValue));
    const statusLabelValue = resolveStatusLabel(statusValue, isSkipped);
    const statusColor = resolveStatusColor(statusValue, isSkipped);
    const taskTitle = resolveTaskTitle(task as TaskWithMetadata);
    const displayMessage = formatTaskDisplayMessage(task.display, t);
    const errorMessage = typeof task.errorMessage === 'string' ? task.errorMessage.trim() : '';
    const fallbackError = typeof task.error === 'string' ? task.error.trim() : '';
    const failedMessage = errorMessage || fallbackError;
    const geometryDetails = parseGeometrySimplifyError(task.message);
    const baseMessage = task.message?.split(' (')[0];
    const failedTaskMessage = task.status === 'failed'
      && failedMessage
      && (!task.message || isTaskPhaseMessage(task.message))
      ? failedMessage
      : null;
    const taskMessage = displayMessage
      ?? failedTaskMessage
      ?? (task.message && task.message !== taskTitle
        ? (geometryDetails ? baseMessage : task.message)
        : undefined);
    const detailLines = displayMessage ? undefined : (geometryDetails ? formatGeometrySimplifySummary(geometryDetails) : undefined);
    const leadingIcon = task.status === 'recycled' ? (
      <RecyclingIcon data-testid="task-icon-recycling" sx={{ fontSize: 16, color: 'text.secondary' }} />
    ) : (
      <AddBoxIcon data-testid="task-icon-add" color="primary" sx={{ fontSize: 16 }} />
    );
    return (
      <Box key={key} sx={style} data-task-id={task.taskId ?? undefined}>
        <TaskItem
          title={taskTitle}
          leadingIcon={leadingIcon}
          statusLabel={statusLabelValue}
          statusColor={statusColor}
          message={taskMessage}
          detailLines={detailLines}
          progress={displayProgress}
          fallbackProgress={stageValue}
        />
      </Box>
    );
  }, [resolveStatusColor, resolveStatusLabel, resolveTaskTitle, stageValue, t]);

  return (
    <Box
      ref={setRefs}
      onWheel={(event) => event.stopPropagation()}
      sx={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}
    >
      {shouldVirtualize ? (
        <Box sx={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const task = orderedTasks[virtualRow.index];
            if (!task) return null;
            const taskTitle = resolveTaskTitle(task as TaskWithMetadata);
            const key = task.taskId ?? `${virtualRow.index}-${taskTitle}`;
            return renderTaskItem(task, key, {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
              paddingRight: 2,
              height: `${TASK_ITEM_HEIGHT}px`,
            });
          })}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pr: 1 }}>
          {orderedTasks.map((task, index) => {
            const taskTitle = resolveTaskTitle(task as TaskWithMetadata);
            const key = task.taskId ?? `${index}-${taskTitle}`;
            return renderTaskItem(task, key);
          })}
        </Box>
      )}
    </Box>
  );
});
