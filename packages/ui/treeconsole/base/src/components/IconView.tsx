/**
 * IconView — displays child nodes as icons with labels.
 *
 * Two layout modes:
 * - Grid (sortMode !== 'none'): CSS Grid auto-fill, sorted by sort comparator
 * - Free positioning (sortMode === 'none'): grid-snapped absolute positioning
 *
 * Icon size and cell size are derived from zoomLevel via computeZoomLayout.
 * Positions are stored as grid coordinates (col, row), not pixel coordinates.
 */

import { useCallback, useMemo, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { NodeTypeIcon } from '@hierarchidb/components';
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

// -- Grid coordinate utilities --

/** Convert grid coordinates (col, row) to pixel position. */
function gridToPixel(col: number, row: number, cellW: number, cellH: number): { px: number; py: number } {
    return {
        px: col * (cellW + CELL_GAP_PX) + CELL_GAP_PX,
        py: row * (cellH + CELL_GAP_PX) + CELL_GAP_PX,
    };
}

/** Snap pixel position to nearest grid coordinate. */
function pixelToGrid(px: number, py: number, cellW: number, cellH: number): { col: number; row: number } {
    return {
        col: Math.max(0, Math.round((px - CELL_GAP_PX) / (cellW + CELL_GAP_PX))),
        row: Math.max(0, Math.round((py - CELL_GAP_PX) / (cellH + CELL_GAP_PX))),
    };
}

/** Find the nearest unoccupied grid cell, spiraling outward from (col, row). */
function findNearestFreeCell(
    col: number,
    row: number,
    occupied: Set<string>,
): { col: number; row: number } {
    if (!occupied.has(`${col},${row}`)) return { col, row };
    for (let radius = 1; radius < 100; radius++) {
        for (let dc = -radius; dc <= radius; dc++) {
            for (let dr = -radius; dr <= radius; dr++) {
                if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue;
                const c = Math.max(0, col + dc);
                const r = Math.max(0, row + dr);
                const key = `${c},${r}`;
                if (!occupied.has(key)) return { col: c, row: r };
            }
        }
    }
    return { col, row };
}

/** Assign initial grid positions to nodes that have no iconPosition. */
function assignInitialPositions(
    nodes: TreeNodeInUI[],
    containerCols: number,
): Map<string, { col: number; row: number }> {
    const positions = new Map<string, { col: number; row: number }>();
    const occupied = new Set<string>();

    // First pass: collect existing positions
    for (const node of nodes) {
        const pos = node.viewProperties?.iconPosition;
        if (pos) {
            positions.set(node.id, { col: pos.x, row: pos.y });
            occupied.add(`${pos.x},${pos.y}`);
        }
    }

    // Second pass: assign positions to nodes without one
    let nextCol = 0;
    let nextRow = 0;
    for (const node of nodes) {
        if (positions.has(node.id)) continue;
        const free = findNearestFreeCell(nextCol, nextRow, occupied);
        positions.set(node.id, free);
        occupied.add(`${free.col},${free.row}`);
        // Advance to next position in row-major order
        nextCol = free.col + 1;
        if (nextCol >= containerCols) {
            nextCol = 0;
            nextRow = free.row + 1;
        }
    }

    return positions;
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
                overflow: 'auto',
                height: '100%',
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

// -- Free Layout (unsorted mode, grid-snapped absolute positioning) --

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
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Estimate columns from container width (fallback 6)
    const containerCols = 6;

    // Assign grid positions (including initial positions for new nodes)
    const gridPositions = useMemo(
        () => assignInitialPositions(nodes, containerCols),
        [nodes, containerCols],
    );

    // Build occupied set for collision detection during drag
    const occupiedSet = useMemo(() => {
        const set = new Set<string>();
        for (const [, pos] of gridPositions) {
            set.add(`${pos.col},${pos.row}`);
        }
        return set;
    }, [gridPositions]);

    // Persist initial positions for nodes that didn't have one
    const persistedRef = useRef(new Set<string>());
    useMemo(() => {
        for (const node of nodes) {
            if (!node.viewProperties?.iconPosition && !persistedRef.current.has(node.id)) {
                const pos = gridPositions.get(node.id);
                if (pos) {
                    persistedRef.current.add(node.id);
                    // Fire position change for newly assigned positions
                    onIconPositionChange(node.id, { x: pos.col, y: pos.row });
                }
            }
        }
    }, [nodes, gridPositions, onIconPositionChange]);

    return (
        <Box
            ref={containerRef}
            sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'auto' }}
        >
            {nodes.map((node) => {
                const gridPos = gridPositions.get(node.id) ?? { col: 0, row: 0 };
                const { px, py } = gridToPixel(gridPos.col, gridPos.row, cellSize.width, cellSize.height);
                return (
                    <DraggableIconCell
                        key={node.id}
                        node={node}
                        iconSize={iconSize}
                        cellSize={cellSize}
                        initialPx={px}
                        initialPy={py}
                        gridCol={gridPos.col}
                        gridRow={gridPos.row}
                        occupiedSet={occupiedSet}
                        onDragEnd={onIconPositionChange}
                        onClick={onNodeClick}
                        onDoubleClick={onNodeDoubleClick}
                    />
                );
            })}
        </Box>
    );
}

// -- Icon Cell (shared rendering with NodeTypeIcon) --

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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <NodeTypeIcon
                    nodeType={node.nodeType}
                    size={`${iconSize}px`}
                    isDraft={(node as { version?: number }).version === 0}
                    buildRequired={node.metadata?.buildMetadata?.buildRequired ?? false}
                />
            </Box>
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

// -- Draggable Icon Cell (grid-snapped with collision avoidance) --

interface DraggableIconCellProps {
    node: TreeNodeInUI;
    iconSize: number;
    cellSize: { width: number; height: number };
    initialPx: number;
    initialPy: number;
    gridCol: number;
    gridRow: number;
    occupiedSet: Set<string>;
    onDragEnd: (nodeId: NodeId, position: { x: number; y: number }) => void;
    onClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
    onDoubleClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
}

function DraggableIconCell({
    node,
    iconSize,
    cellSize,
    initialPx,
    initialPy,
    gridCol,
    gridRow,
    occupiedSet,
    onDragEnd,
    onClick,
    onDoubleClick,
}: DraggableIconCellProps) {
    const posRef = useRef({ px: initialPx, py: initialPy });
    const dragRef = useRef<{ startX: number; startY: number; origPx: number; origPy: number } | null>(null);
    const elementRef = useRef<HTMLDivElement | null>(null);
    const movedRef = useRef(false);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origPx: posRef.current.px,
            origPy: posRef.current.py,
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
        const newPx = drag.origPx + dx;
        const newPy = drag.origPy + dy;
        posRef.current = { px: newPx, py: newPy };
        if (elementRef.current) {
            elementRef.current.style.left = `${newPx}px`;
            elementRef.current.style.top = `${newPy}px`;
        }
    }, []);

    const handlePointerUp = useCallback(() => {
        if (dragRef.current && movedRef.current) {
            // Snap to grid
            const { col, row } = pixelToGrid(
                posRef.current.px,
                posRef.current.py,
                cellSize.width,
                cellSize.height,
            );
            // Collision avoidance: exclude self from occupied set
            const othersOccupied = new Set(occupiedSet);
            othersOccupied.delete(`${gridCol},${gridRow}`);
            const free = findNearestFreeCell(col, row, othersOccupied);
            // Snap to the resolved grid position
            const snapped = gridToPixel(free.col, free.row, cellSize.width, cellSize.height);
            posRef.current = { px: snapped.px, py: snapped.py };
            if (elementRef.current) {
                elementRef.current.style.left = `${snapped.px}px`;
                elementRef.current.style.top = `${snapped.py}px`;
            }
            // Persist grid coordinates (not pixels)
            onDragEnd(node.id, { x: free.col, y: free.row });
        }
        dragRef.current = null;
    }, [node.id, onDragEnd, cellSize, occupiedSet, gridCol, gridRow]);

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
                left: initialPx,
                top: initialPy,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: cellSize.width,
                cursor: 'grab',
                userSelect: 'none',
                touchAction: 'none',
            }}
        >
            <Box
                sx={{
                    width: iconSize,
                    height: iconSize,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                }}
            >
                <NodeTypeIcon
                    nodeType={node.nodeType}
                    size={`${iconSize}px`}
                    isDraft={(node as { version?: number }).version === 0}
                    buildRequired={node.metadata?.buildMetadata?.buildRequired ?? false}
                />
            </Box>
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
