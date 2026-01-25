import { type CSSProperties, useEffect, useMemo, useRef } from 'react';
import { Box } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSetAtom } from 'jotai';
import type { ShapeBuildTaskSummary } from '../../atoms/shapeBuildProgressAtoms.js';
import { taskViewportRangeAtom } from '../../atoms/shapeBuildProgressAtoms.js';
import { TaskItem } from './TaskItem.tsx';
import { formatGeometrySimplifySummary, parseGeometrySimplifyError } from './geometrySimplifyError.ts';
import { useTranslation } from '../../i18n.js';

export type TaskWithMetadata = ShapeBuildTaskSummary & { title?: string };

export const isSkippedMessage = (message?: string | null): boolean => {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  return normalized === 'skipped' || normalized.startsWith('skipped:');
};

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

export const TaskListVirtualized = ({
  stageId,
  tasks,
  stageValue,
  resolveStatusLabel,
  resolveStatusColor,
  resolveTaskTitle,
  scrollToTaskId,
  scrollRequestId,
  virtualize = true,
}: TaskListProps) => {
  const { t } = useTranslation();
  const shouldVirtualize = virtualize;
  const parentRef = useRef<HTMLDivElement | null>(null);
  const setViewportRange = useSetAtom(taskViewportRangeAtom);
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
    estimateSize: () => 72,
    overscan: 8,
  });
  const phaseLabels = useMemo(() => new Map<string, { key: string; fallback: string }>([
    ['fetch-cache:start', { key: 'stage.taskPhase.fetchCacheStart', fallback: 'Fetch cache start' }],
    ['fetch-cache:done', { key: 'stage.taskPhase.fetchCacheDone', fallback: 'Fetch cache done' }],
    ['decode:start', { key: 'stage.taskPhase.decodeStart', fallback: 'Decode start' }],
    ['decode:done', { key: 'stage.taskPhase.decodeDone', fallback: 'Decode done' }],
    ['filtering:start', { key: 'stage.taskPhase.filteringStart', fallback: 'Filtering start' }],
    ['filtering:done', { key: 'stage.taskPhase.filteringDone', fallback: 'Filtering done' }],
    ['prepare:counts:start', { key: 'stage.taskPhase.prepareCountsStart', fallback: 'Prepare counts start' }],
    ['prepare:counts:done', { key: 'stage.taskPhase.prepareCountsDone', fallback: 'Prepare counts done' }],
    ['simplify:start', { key: 'stage.taskPhase.simplifyStart', fallback: 'Simplify start' }],
    ['simplify:done', { key: 'stage.taskPhase.simplifyDone', fallback: 'Simplify done' }],
    ['simplify:preprocess:start', { key: 'stage.taskPhase.simplifyPreprocessStart', fallback: 'Preprocess start' }],
    ['simplify:preprocess:done', { key: 'stage.taskPhase.simplifyPreprocessDone', fallback: 'Preprocess done' }],
    ['simplify:selfIntersection:start', { key: 'stage.taskPhase.simplifySelfIntersectionStart', fallback: 'Self-intersection fix start' }],
    ['simplify:selfIntersection:done', { key: 'stage.taskPhase.simplifySelfIntersectionDone', fallback: 'Self-intersection fix done' }],
    ['simplify:simplify:start', { key: 'stage.taskPhase.simplifyGeometryStart', fallback: 'Geometry simplify start' }],
    ['simplify:simplify:done', { key: 'stage.taskPhase.simplifyGeometryDone', fallback: 'Geometry simplify done' }],
    ['output:build:start', { key: 'stage.taskPhase.outputBuildStart', fallback: 'Output build start' }],
    ['output:build:done', { key: 'stage.taskPhase.outputBuildDone', fallback: 'Output build done' }],
    ['output:counts:start', { key: 'stage.taskPhase.outputCountsStart', fallback: 'Output counts start' }],
    ['encode:start', { key: 'stage.taskPhase.encodeStart', fallback: 'Encode start' }],
    ['encode:done', { key: 'stage.taskPhase.encodeDone', fallback: 'Encode done' }],
    ['cache:put:start', { key: 'stage.taskPhase.cachePutStart', fallback: 'Cache write start' }],
    ['cache:put:done', { key: 'stage.taskPhase.cachePutDone', fallback: 'Cache write done' }],
  ]), []);
  const resolvePhaseMessage = useMemo(() => {
    return (message?: string | null): string | null => {
      if (!message) return null;
      const match = message.match(/^phase=([a-z0-9:-]+)$/i);
      if (!match) return null;
      const phase = match[1];
      if (!phase) return null;
      const entry = phaseLabels.get(phase);
      if (!entry) return null;
      return t(entry.key, entry.fallback);
    };
  }, [phaseLabels, t]);

  useEffect(() => {
    if (!shouldVirtualize) return;
    if (!scrollToTaskId) return;
    const index = tasks.findIndex((task) => task.taskId === scrollToTaskId);
    if (index < 0) return;
    virtualizer.scrollToIndex(index, { align: 'center' });
  }, [scrollRequestId, scrollToTaskId, shouldVirtualize, tasks, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();
  useEffect(() => {
    if (!shouldVirtualize) return;
    if (tasks.length === 0 || virtualItems.length === 0) {
      setViewportRange((prev) => (prev && prev.stageId === stageId ? null : prev));
      lastViewportRef.current = null;
      return;
    }
    const startIndex = virtualItems[0]?.index ?? 0;
    const endIndex = virtualItems[virtualItems.length - 1]?.index ?? startIndex;
    const startTaskId = tasks[startIndex]?.taskId ?? '';
    const endTaskId = tasks[endIndex]?.taskId ?? startTaskId;
    if (!startTaskId || !endTaskId) return;
    const next = {
      stageId,
      startIndex,
      endIndex,
      startTaskId,
      endTaskId,
      total: tasks.length,
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
  }, [setViewportRange, shouldVirtualize, stageId, tasks, virtualItems]);

  useEffect(() => {
    if (shouldVirtualize) return;
    if (tasks.length === 0) {
      setViewportRange((prev) => (prev && prev.stageId === stageId ? null : prev));
      lastViewportRef.current = null;
      return;
    }
    const startIndex = 0;
    const endIndex = tasks.length - 1;
    const startTaskId = tasks[startIndex]?.taskId ?? '';
    const endTaskId = tasks[endIndex]?.taskId ?? startTaskId;
    if (!startTaskId || !endTaskId) return;
    const next = {
      stageId,
      startIndex,
      endIndex,
      startTaskId,
      endTaskId,
      total: tasks.length,
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
  }, [setViewportRange, shouldVirtualize, stageId, tasks]);

  const renderTaskItem = (task: ShapeBuildTaskSummary, key: string, style?: CSSProperties) => {
    const statusValue = task.status;
    const isSkipped = isSkippedMessage(task.message);
    const statusLabelValue = resolveStatusLabel(statusValue, isSkipped);
    const statusColor = resolveStatusColor(statusValue, isSkipped);
    const taskTitle = resolveTaskTitle(task as TaskWithMetadata);
    const phaseMessage = resolvePhaseMessage(task.message);
    const geometryDetails = parseGeometrySimplifyError(task.message);
    const baseMessage = task.message?.split(' (')[0];
    const taskMessage = phaseMessage
      ?? (task.message && task.message !== taskTitle
        ? (geometryDetails ? baseMessage : task.message)
        : undefined);
    const detailLines = phaseMessage ? undefined : (geometryDetails ? formatGeometrySimplifySummary(geometryDetails) : undefined);
    return (
      <Box key={key} sx={style}>
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
  };

  return (
    <Box ref={parentRef} sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      {shouldVirtualize ? (
        <Box sx={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const task = tasks[virtualRow.index];
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
            });
          })}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pr: 1 }}>
          {tasks.map((task, index) => {
            const taskTitle = resolveTaskTitle(task as TaskWithMetadata);
            const key = task.taskId ?? `${index}-${taskTitle}`;
            return renderTaskItem(task, key);
          })}
        </Box>
      )}
    </Box>
  );
};
