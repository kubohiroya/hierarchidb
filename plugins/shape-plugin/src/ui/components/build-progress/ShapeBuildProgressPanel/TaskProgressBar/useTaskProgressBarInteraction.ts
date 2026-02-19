import { type PointerEvent, useCallback, useRef } from 'react';
import { useSetAtom } from 'jotai';
import { taskScrollTargetAtom } from '../../../../atoms/shapeBuildProgressAtoms.js';
import type { TaskProgressSegment } from './useTaskProgressBarComputation.js';

type InteractionInput = {
  segments: TaskProgressSegment[];
  viewWidth: number;
  dragDebounceMs?: number;
};

const resolveTargetFromPosition = (segments: TaskProgressSegment[], position: number) => {
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
};

const resolveNearestInteractiveSegment = (segments: TaskProgressSegment[], index: number) => {
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
};

export const useTaskProgressBarInteraction = ({
  segments,
  viewWidth,
}: InteractionInput) => {
  const setScrollTarget = useSetAtom(taskScrollTargetAtom);
  const isDraggingRef = useRef(false);
  const dragDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragDebounceMs = 80;

  const updateScrollTargetFromClientX = useCallback((clientX: number, rect: DOMRect) => {
    if (!rect || rect.width <= 0 || viewWidth <= 0) return;
    const ratio = (clientX - rect.left) / rect.width;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const position = clampedRatio * viewWidth;
    const resolved = resolveTargetFromPosition(segments, position);
    if (!resolved) return;
    const segment = resolved.segment.taskId
      ? resolved.segment
      : resolveNearestInteractiveSegment(segments, resolved.index);
    if (!segment?.taskId) return;
    setScrollTarget({
      stageId: segment.stageId,
      taskId: segment.taskId,
      requestedAt: Date.now(),
    });
  }, [segments, setScrollTarget, viewWidth]);

  const onPointerDown = useCallback((event: PointerEvent<SVGSVGElement>) => {
    event.preventDefault();
    isDraggingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateScrollTargetFromClientX(event.clientX, event.currentTarget.getBoundingClientRect());
  }, [updateScrollTargetFromClientX]);

  const onPointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
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

  const onPointerUp = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (dragDebounceRef.current) {
      clearTimeout(dragDebounceRef.current);
      dragDebounceRef.current = null;
    }
    updateScrollTargetFromClientX(event.clientX, event.currentTarget.getBoundingClientRect());
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, [updateScrollTargetFromClientX]);

  const onActivateTaskSegment = useCallback((segment: TaskProgressSegment) => {
    if (!segment.taskId) return;
    setScrollTarget({
      stageId: segment.stageId,
      taskId: segment.taskId,
      requestedAt: Date.now(),
    });
  }, [setScrollTarget]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onActivateTaskSegment,
    updateScrollTargetFromClientX,
  };
};
