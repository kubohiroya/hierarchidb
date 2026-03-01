import { type ForwardedRef, type MutableRefObject, useCallback, useEffect, useMemo, useRef } from 'react';
import { type Virtualizer, useVirtualizer } from '@tanstack/react-virtual';
import { useSetAtom } from 'jotai';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import { taskViewportRangeAtom } from '~/ui/atoms/shapeBuildProgressAtoms';
import { TASK_ITEM_HEIGHT } from '~/ui/components/build-progress/TaskItem/taskItem.constants';
import { type TaskItemWithMetadata } from './types.js';
import { isGeometryLikeStageId, isTileEmitLikeStageId } from '~/ui/components/build-progress/stageIdAliases';

type TaskItemCardListArgs = {
  stageId: string;
  tasks: ShapeBuildTaskSummary[];
  scrollToTaskId?: string;
  scrollRequestId?: number;
  virtualize?: boolean;
  ref?: ForwardedRef<HTMLDivElement>;
};

type TaskItemCardListState = {
  orderedTasks: ShapeBuildTaskSummary[];
  shouldVirtualize: boolean;
  setRefs: (node: HTMLDivElement | null) => void;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
};

const getVectorTileCoordsFromTitle = (task: ShapeBuildTaskSummary): { z: number; x: number; y: number } | null => {
  const title = (task as TaskItemWithMetadata).title;
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

export const sortGeometryTasks = (tasks: ShapeBuildTaskSummary[]): ShapeBuildTaskSummary[] => {
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

export const sortTransformTasks = sortGeometryTasks;

export const useTaskItemCardList = ({
  stageId,
  tasks,
  scrollToTaskId,
  scrollRequestId,
  virtualize = true,
  ref,
}: TaskItemCardListArgs): TaskItemCardListState => {
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
  const orderedTasks = useMemo(() => {
    if (isTileEmitLikeStageId(stageId)) return sortVectorTileTasks(tasks);
    if (isGeometryLikeStageId(stageId)) return sortGeometryTasks(tasks);
    return tasks;
  }, [stageId, tasks]);
  const virtualizer = useVirtualizer<HTMLDivElement, Element>({
    count: orderedTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => TASK_ITEM_HEIGHT,
    overscan: 8,
  });

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
      if (orderedTasks.length === 0) {
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
  }, [setViewportRange, shouldVirtualize, stageId, orderedTasks]);

  useEffect(() => {
    if (shouldVirtualize) return;
    if (orderedTasks.length === 0) {
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
  }, [setViewportRange, shouldVirtualize, stageId, orderedTasks]);

  return {
    orderedTasks,
    shouldVirtualize,
    setRefs,
    virtualizer,
  };
};
