/**
 * Shared background interaction hook for IconView layouts.
 *
 * Handles:
 * - Left click on background → deselect all
 * - Left drag on background → rubber-band rectangle selection
 * - Long press (500ms) → background context menu
 * - Right click → background context menu
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const DRAG_THRESHOLD = 5;
const LONG_PRESS_MS = 500;

export interface RubberBandRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface UseIconViewBackgroundArgs {
    onNodeSelect?: (nodeIds: string[], selected: boolean) => void;
    onBackgroundContextMenu?: (position: { left: number; top: number }) => void;
    onRubberBandSelect?: (rect: RubberBandRect) => void;
}

export function useIconViewBackground({
    onNodeSelect,
    onBackgroundContextMenu,
    onRubberBandSelect,
}: UseIconViewBackgroundArgs) {
    const [rubberBand, setRubberBand] = useState<RubberBandRect | null>(null);
    const rubberBandRef = useRef<RubberBandRect | null>(null);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const longPressRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const longPressFiredRef = useRef(false);
    const isDraggingRef = useRef(false);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const container = e.currentTarget as HTMLElement;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left + container.scrollLeft;
        const y = e.clientY - rect.top + container.scrollTop;

        dragStartRef.current = { x, y };
        isDraggingRef.current = false;
        longPressFiredRef.current = false;
        rubberBandRef.current = null;
        setRubberBand(null);

        const clientX = e.clientX;
        const clientY = e.clientY;
        longPressRef.current = setTimeout(() => {
            longPressFiredRef.current = true;
            dragStartRef.current = null;
            rubberBandRef.current = null;
            setRubberBand(null);
            onBackgroundContextMenu?.({ left: clientX, top: clientY });
        }, LONG_PRESS_MS);
    }, [onBackgroundContextMenu]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const start = dragStartRef.current;
        if (!start) return;

        const container = e.currentTarget as HTMLElement;
        const rect = container.getBoundingClientRect();
        const currentX = e.clientX - rect.left + container.scrollLeft;
        const currentY = e.clientY - rect.top + container.scrollTop;
        const dx = currentX - start.x;
        const dy = currentY - start.y;

        if (!isDraggingRef.current && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
            isDraggingRef.current = true;
            if (longPressRef.current !== undefined) {
                clearTimeout(longPressRef.current);
                longPressRef.current = undefined;
            }
        }

        if (isDraggingRef.current) {
            const rb: RubberBandRect = {
                x: Math.min(start.x, currentX),
                y: Math.min(start.y, currentY),
                width: Math.abs(dx),
                height: Math.abs(dy),
            };
            rubberBandRef.current = rb;
            setRubberBand(rb);
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        if (longPressRef.current !== undefined) {
            clearTimeout(longPressRef.current);
            longPressRef.current = undefined;
        }

        if (longPressFiredRef.current) {
            dragStartRef.current = null;
            return;
        }

        if (isDraggingRef.current && rubberBandRef.current) {
            onRubberBandSelect?.(rubberBandRef.current);
            rubberBandRef.current = null;
            setRubberBand(null);
        } else {
            onNodeSelect?.([], false);
        }

        dragStartRef.current = null;
        isDraggingRef.current = false;
    }, [onRubberBandSelect, onNodeSelect]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (longPressRef.current !== undefined) {
            clearTimeout(longPressRef.current);
            longPressRef.current = undefined;
        }
        dragStartRef.current = null;
        isDraggingRef.current = false;
        rubberBandRef.current = null;
        setRubberBand(null);
        onBackgroundContextMenu?.({ left: e.clientX, top: e.clientY });
    }, [onBackgroundContextMenu]);

    // Clean up long-press timeout on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            if (longPressRef.current !== undefined) {
                clearTimeout(longPressRef.current);
            }
        };
    }, []);

    return {
        rubberBand,
        bgHandlers: {
            onMouseDown: handleMouseDown,
            onMouseMove: handleMouseMove,
            onMouseUp: handleMouseUp,
            onContextMenu: handleContextMenu,
        },
    };
}
