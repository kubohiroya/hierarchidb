/**
 * IconView — displays child nodes as icons with labels.
 *
 * Two layout modes:
 * - Grid (sortMode !== 'none'): CSS Grid auto-fill, sorted by sort comparator
 * - Free positioning (sortMode === 'none'): absolute positioning via iconPosition
 *
 * Icon size and cell size are derived from zoomLevel via computeZoomLayout.
 */

import { useCallback, useMemo, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNodeInUI } from '@hierarchidb/ui-treeconsole-treetable';
import type { SortMode } from '~/types/view-mode-types';
import { computeZoomLayout, CELL_GAP_PX } from '~/utils/zoom-layout';
import { createSortComparator } from '~/utils/sort-comparator';

export interface IconViewProps {
    nodes: TreeNodeInUI[];
    zoomLevel: number;
    sortMode: SortMode;
    onIconPositionChange: (nodeId: NodeId, position: { x: number; y: number }) => void;
    onNodeClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
    onNodeDoubleClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
}

export function IconView({
    nodes,
    zoomLevel,
    sortMode,
    onIconPositionChange,
    onNodeClick,
    onNodeDoubleClick,
}: IconViewProps) {
    const { iconSize, cellSize } = computeZoomLayout(zoomLevel);

    const sortedNodes = useMemo(() => {
        if (sortMode === 'none') return nodes;
        const comparator = createSortComparator(sortMode);
        return [...nodes].sort(comparator);
    }, [nodes, sortMode]);

    const isGrid = sortMode !== 'none';

    if (isGrid) {
        return (
            <GridLayout
                nodes={sortedNodes}
                iconSize={iconSize}
                cellSize={cellSize}
                onNodeClick={onNodeClick}
                onNodeDoubleClick={onNodeDoubleClick}
            />
        );
    }

    return (
        <FreeLayout
            nodes={nodes}
            iconSize={iconSize}
            cellSize={cellSize}
            onIconPositionChange={onIconPositionChange}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
        />
    );
}

// -- Grid Layout (sorted mode) --

interface GridLayoutProps {
    nodes: TreeNodeInUI[];
    iconSize: number;
    cellSize: { width: number; height: number };
    onNodeClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
    onNodeDoubleClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
}

function GridLayout({ nodes, iconSize, cellSize, onNodeClick, onNodeDoubleClick }: GridLayoutProps) {
    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fill, ${cellSize.width}px)`,
                gap: `${CELL_GAP_PX}px`,
                padding: `${CELL_GAP_PX}px`,
                width: '100%',
            }}
        >
            {nodes.map((node) => (
                <IconCell
                    key={node.id}
                    node={node}
                    iconSize={iconSize}
                    cellWidth={cellSize.width}
                    onClick={onNodeClick}
                    onDoubleClick={onNodeDoubleClick}
                />
            ))}
        </Box>
    );
}

// -- Free Layout (unsorted mode, absolute positioning) --

interface FreeLayoutProps {
    nodes: TreeNodeInUI[];
    iconSize: number;
    cellSize: { width: number; height: number };
    onIconPositionChange: (nodeId: NodeId, position: { x: number; y: number }) => void;
    onNodeClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
    onNodeDoubleClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
}

function FreeLayout({
    nodes,
    iconSize,
    cellSize,
    onIconPositionChange,
    onNodeClick,
    onNodeDoubleClick,
}: FreeLayoutProps) {
    return (
        <Box sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'auto' }}>
            {nodes.map((node) => {
                const pos = node.viewProperties?.iconPosition ?? { x: 0, y: 0 };
                return (
                    <DraggableIconCell
                        key={node.id}
                        node={node}
                        iconSize={iconSize}
                        cellWidth={cellSize.width}
                        initialX={pos.x}
                        initialY={pos.y}
                        onDragEnd={onIconPositionChange}
                        onClick={onNodeClick}
                        onDoubleClick={onNodeDoubleClick}
                    />
                );
            })}
        </Box>
    );
}

// -- Icon Cell (shared rendering) --

interface IconCellProps {
    node: TreeNodeInUI;
    iconSize: number;
    cellWidth: number;
    onClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
    onDoubleClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
}

function IconCell({ node, iconSize, cellWidth, onClick, onDoubleClick }: IconCellProps) {
    const handleClick = useCallback(() => onClick?.(node.id, node), [onClick, node]);
    const handleDoubleClick = useCallback(() => onDoubleClick?.(node.id, node), [onDoubleClick, node]);

    return (
        <Box
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: cellWidth,
                cursor: 'pointer',
                userSelect: 'none',
            }}
        >
            <Box
                sx={{
                    width: iconSize,
                    height: iconSize,
                    backgroundColor: 'action.hover',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            />
            <Typography
                variant="caption"
                noWrap={false}
                sx={{
                    textAlign: 'center',
                    width: '100%',
                    minHeight: '2em',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                }}
            >
                {node.metadata.name}
            </Typography>
        </Box>
    );
}

// -- Draggable Icon Cell (free positioning with pointer events) --

interface DraggableIconCellProps {
    node: TreeNodeInUI;
    iconSize: number;
    cellWidth: number;
    initialX: number;
    initialY: number;
    onDragEnd: (nodeId: NodeId, position: { x: number; y: number }) => void;
    onClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
    onDoubleClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
}

function DraggableIconCell({
    node,
    iconSize,
    cellWidth,
    initialX,
    initialY,
    onDragEnd,
    onClick,
    onDoubleClick,
}: DraggableIconCellProps) {
    const posRef = useRef({ x: initialX, y: initialY });
    const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
    const elementRef = useRef<HTMLDivElement | null>(null);
    const movedRef = useRef(false);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origX: posRef.current.x,
            origY: posRef.current.y,
        };
        movedRef.current = false;
    }, []);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            movedRef.current = true;
        }
        const newX = drag.origX + dx;
        const newY = drag.origY + dy;
        posRef.current = { x: newX, y: newY };
        if (elementRef.current) {
            elementRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
        }
    }, []);

    const handlePointerUp = useCallback(() => {
        if (dragRef.current && movedRef.current) {
            onDragEnd(node.id, posRef.current);
        }
        dragRef.current = null;
    }, [node.id, onDragEnd]);

    const handleClick = useCallback(() => {
        if (!movedRef.current) {
            onClick?.(node.id, node);
        }
    }, [onClick, node]);

    const handleDoubleClick = useCallback(() => {
        onDoubleClick?.(node.id, node);
    }, [onDoubleClick, node]);

    return (
        <Box
            ref={elementRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            sx={{
                position: 'absolute',
                transform: `translate(${initialX}px, ${initialY}px)`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: cellWidth,
                cursor: 'grab',
                userSelect: 'none',
                touchAction: 'none',
            }}
        >
            <Box
                sx={{
                    width: iconSize,
                    height: iconSize,
                    backgroundColor: 'action.hover',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                }}
            />
            <Typography
                variant="caption"
                noWrap={false}
                sx={{
                    textAlign: 'center',
                    width: '100%',
                    minHeight: '2em',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    pointerEvents: 'none',
                }}
            >
                {node.metadata.name}
            </Typography>
        </Box>
    );
}
