/**
 * @file useResizing.ts
 * @description Low-level hook for resize operations
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Size } from '~/types/WindowState';

export interface UseResizingOptions {
  onResizeStart?: () => void;
  onResize?: (size: Size) => void;
  onResizeEnd?: (size: Size) => void;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface UseResizingResult {
  isResizing: boolean;
  resizeDirection: string;
  onMouseDown: (direction: string) => (e: React.MouseEvent) => void;
}

export function useResizing(options: UseResizingOptions = {}): UseResizingResult {
  const {
    onResizeStart,
    onResize,
    onResizeEnd,
    minWidth = 100,
    minHeight = 50,
    maxWidth = window.innerWidth,
    maxHeight = window.innerHeight,
  } = options;

  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState('');
  const initialSize = useRef<Size>({ width: 0, height: 0 });
  const initialMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const elementRef = useRef<HTMLElement | null>(null);

  const handleMouseDown = useCallback(
    (direction: string) => (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Only left click

      const element = (e.currentTarget as HTMLElement).closest('.floating-window') as HTMLElement;
      if (!element) return;

      elementRef.current = element;
      const rect = element.getBoundingClientRect();

      initialSize.current = { width: rect.width, height: rect.height };
      initialMousePos.current = { x: e.clientX, y: e.clientY };

      setIsResizing(true);
      setResizeDirection(direction);
      onResizeStart?.();

      e.preventDefault();
      e.stopPropagation();
    },
    [onResizeStart]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - initialMousePos.current.x;
      const deltaY = e.clientY - initialMousePos.current.y;

      let newWidth = initialSize.current.width;
      let newHeight = initialSize.current.height;

      // Handle horizontal resizing
      if (resizeDirection.includes('e')) {
        newWidth = initialSize.current.width + deltaX;
      } else if (resizeDirection.includes('w')) {
        newWidth = initialSize.current.width - deltaX;
      }

      // Handle vertical resizing
      if (resizeDirection.includes('s')) {
        newHeight = initialSize.current.height + deltaY;
      } else if (resizeDirection.includes('n')) {
        newHeight = initialSize.current.height - deltaY;
      }

      // Apply constraints
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

      const newSize = { width: newWidth, height: newHeight };
      onResize?.(newSize);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const deltaX = e.clientX - initialMousePos.current.x;
      const deltaY = e.clientY - initialMousePos.current.y;

      let finalWidth = initialSize.current.width;
      let finalHeight = initialSize.current.height;

      // Handle horizontal resizing
      if (resizeDirection.includes('e')) {
        finalWidth = initialSize.current.width + deltaX;
      } else if (resizeDirection.includes('w')) {
        finalWidth = initialSize.current.width - deltaX;
      }

      // Handle vertical resizing
      if (resizeDirection.includes('s')) {
        finalHeight = initialSize.current.height + deltaY;
      } else if (resizeDirection.includes('n')) {
        finalHeight = initialSize.current.height - deltaY;
      }

      // Apply constraints
      finalWidth = Math.max(minWidth, Math.min(maxWidth, finalWidth));
      finalHeight = Math.max(minHeight, Math.min(maxHeight, finalHeight));

      setIsResizing(false);
      setResizeDirection('');
      onResizeEnd?.({ width: finalWidth, height: finalHeight });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    isResizing,
    resizeDirection,
    onResize,
    onResizeEnd,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
  ]);

  return {
    isResizing,
    resizeDirection,
    onMouseDown: handleMouseDown,
  };
}
