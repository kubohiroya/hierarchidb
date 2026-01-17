import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ShapeBuildTaskSummary } from '../../atoms/shapeBuildProgressAtoms.js';
import { TaskItem } from './TaskItem.tsx';
import { formatGeometrySimplifySummary, parseGeometrySimplifyError } from './geometrySimplifyError.ts';

export type TaskWithMetadata = ShapeBuildTaskSummary & { title?: string };

export const isSkippedMessage = (message?: string | null): boolean => {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  return normalized === 'skipped' || normalized.startsWith('skipped:');
};

type TaskListProps = {
  tasks: ShapeBuildTaskSummary[];
  stageValue: number;
  resolveStatusLabel: (statusValue?: string, skipped?: boolean) => string;
  resolveStatusColor: (statusValue?: string, skipped?: boolean) => 'default' | 'success' | 'error' | 'warning' | 'info';
  resolveTaskTitle: (task: TaskWithMetadata) => string;
  scrollToTaskId?: string;
  scrollRequestId?: number;
};

const getVectorTileCoordsFromTitle = (task: ShapeBuildTaskSummary): { z: number; x: number; y: number } | null => {
  const title = (task as TaskWithMetadata).title;
  if (!title) return null;
  const match = title.match(/z\s*(\d+)\s*\/\s*x\s*(\d+)\s*y\s*(\d+)/i);
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

export const TaskListVirtualized = ({
  tasks,
  stageValue,
  resolveStatusLabel,
  resolveStatusColor,
  resolveTaskTitle,
  scrollToTaskId,
  scrollRequestId,
}: TaskListProps) => {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  useEffect(() => {
    if (!scrollToTaskId) return;
    const index = tasks.findIndex((task) => task.taskId === scrollToTaskId);
    if (index < 0) return;
    virtualizer.scrollToIndex(index, { align: 'center' });
  }, [scrollRequestId, scrollToTaskId, tasks, virtualizer]);

  return (
    <Box ref={parentRef} sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      <Box sx={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const task = tasks[virtualRow.index];
          if (!task) return null;
          const statusValue = task.status;
          const isSkipped = isSkippedMessage(task.message);
          const statusLabelValue = resolveStatusLabel(statusValue, isSkipped);
          const statusColor = resolveStatusColor(statusValue, isSkipped);
          const taskTitle = resolveTaskTitle(task as TaskWithMetadata);
          const geometryDetails = parseGeometrySimplifyError(task.message);
          const baseMessage = task.message?.split(' (')[0];
          const taskMessage = task.message && task.message !== taskTitle
            ? (geometryDetails ? baseMessage : task.message)
            : undefined;
          const detailLines = geometryDetails ? formatGeometrySimplifySummary(geometryDetails) : undefined;
          return (
            <Box
              key={task.taskId ?? `${virtualRow.index}-${taskTitle}`}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                pr: 1,
              }}
            >
              <TaskItem
                title={taskTitle}
                statusLabel={statusLabelValue}
                statusColor={statusColor}
                message={taskMessage}
                detailLines={detailLines}
                progress={task.progress}
                fallbackProgress={stageValue}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
