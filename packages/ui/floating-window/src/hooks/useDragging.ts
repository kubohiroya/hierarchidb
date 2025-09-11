/**
 * @file useDragging.ts
 * @description Low-level hook for drag operations
 */

import { useCallback, useEffect, useRef, useState } from 'react';
/* eslint-disable no-unused-vars */
import type React from 'react';
import type { Position } from '../types/WindowState';

export interface UseDraggingOptions {
  onDragStart?: () => void;
  onDrag?: (position: Position) => void;
  onDragEnd?: (position: Position) => void;
  constraints?: {
    minX?: number;
    minY?: number;
    maxX?: number;
    maxY?: number;
  };
}

export interface UseDraggingResult {
  isDragging: boolean;
  dragOffset: Position;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function useDragging(options: UseDraggingOptions = {}): UseDraggingResult {
  const {
    onDragStart,
    onDrag,
    onDragEnd,
    constraints,
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const dragStartPos = useRef<Position>({ x: 0, y: 0 });
  const initialMousePos = useRef<Position>({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragStartPos.current = { x: rect.left, y: rect.top };
    initialMousePos.current = { x: e.clientX, y: e.clientY };

    setIsDragging(true);
    onDragStart?.();

    e.preventDefault();
  }, [onDragStart]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - initialMousePos.current.x;
      const deltaY = e.clientY - initialMousePos.current.y;

      let newX = dragStartPos.current.x + deltaX;
      let newY = dragStartPos.current.y + deltaY;

      // Apply constraints
      if (constraints) {
        if (constraints.minX !== undefined) newX = Math.max(constraints.minX, newX);
        if (constraints.maxX !== undefined) newX = Math.min(constraints.maxX, newX);
        if (constraints.minY !== undefined) newY = Math.max(constraints.minY, newY);
        if (constraints.maxY !== undefined) newY = Math.min(constraints.maxY, newY);
      }

      const newPosition = { x: newX, y: newY };
      setDragOffset({ x: deltaX, y: deltaY });
      onDrag?.(newPosition);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const deltaX = e.clientX - initialMousePos.current.x;
      const deltaY = e.clientY - initialMousePos.current.y;

      let finalX = dragStartPos.current.x + deltaX;
      let finalY = dragStartPos.current.y + deltaY;

      // Apply constraints
      if (constraints) {
        if (constraints.minX !== undefined) finalX = Math.max(constraints.minX, finalX);
        if (constraints.maxX !== undefined) finalX = Math.min(constraints.maxX, finalX);
        if (constraints.minY !== undefined) finalY = Math.max(constraints.minY, finalY);
        if (constraints.maxY !== undefined) finalY = Math.min(constraints.maxY, finalY);
      }

      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
      onDragEnd?.({ x: finalX, y: finalY });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onDrag, onDragEnd, constraints]);

  return {
    isDragging,
    dragOffset,
    onMouseDown: handleMouseDown,
  };
}
