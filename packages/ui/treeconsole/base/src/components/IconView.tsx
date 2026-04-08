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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { NodeTypeIcon } from '@hierarchidb/components';
import { getPluginIconColor, isFolderNodeType } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { rainbowColors } from '@hierarchidb/ui-theme';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNodeInUI } from '@hierarchidb/ui-treeconsole-treetable';
import type { SortMode } from '~/types/view-mode-types';
import { computeZoomLayout, CELL_GAP_PX } from '~/utils/zoom-layout';
import { createSortComparator } from '~/utils/sort-comparator';

/** Resolve icon color matching the list view logic. */
function resolveIconColor(node: TreeNodeInUI): string {
    const nodeType = String(node.nodeType ?? 'folder');
    const depth = node.depth ?? 0;
    const baseColor = rainbowColors[Math.max(0, depth) % rainbowColors.length];
    if (isFolderNodeType(nodeType)) return baseColor;
    return getPluginIconColor(nodeType) ?? baseColor;
}

export interface IconViewProps {
    nodes: TreeNodeInUI[];
    zoomLevel: number;
    sortMode: SortMode;
    selectedIds?: Set<string>;
    onIconPositionChange: (nodeId: NodeId, position: { x: number; y: number }) => void;
    onNodeClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
    onNodeDoubleClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
    onNodeSelect?: (nodeIds: string[], selected: boolean) => void;
    onContextMenu?: (node: TreeNodeInUI, position: { left: number; top: number }) => void;
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
    selectedIds,
    onIconPositionChange,
    onNodeClick,
    onNodeDoubleClick,
    onNodeSelect,
    onContextMenu,
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
                sortMode={sortMode}
                selectedIds={selectedIds}
                onNodeClick={onNodeClick}
                onNodeDoubleClick={onNodeDoubleClick}
                onNodeSelect={onNodeSelect}
                onContextMenu={onContextMenu}
            />
        );
    }

    return (
        <FreeLayout
            nodes={nodes}
            iconSize={iconSize}
            cellSize={cellSize}
            selectedIds={selectedIds}
            onIconPositionChange={onIconPositionChange}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeSelect={onNodeSelect}
            onContextMenu={onContextMenu}
        />
    );
}

// -- Grid Layout (sorted mode) --

interface GridLayoutProps {
    nodes: TreeNodeInUI[];
    iconSize: number;
    cellSize: { width: number; height: number };
    sortMode: SortMode;
    selectedIds?: Set<string>;
    onNodeClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
    onNodeDoubleClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
    onNodeSelect?: (nodeIds: string[], selected: boolean) => void;
    onContextMenu?: (node: TreeNodeInUI, position: { left: number; top: number }) => void;
}

const SORT_MODE_LABELS: Record<string, string> = {
    name: 'Name',
    type: 'Type',
    lastOpened: 'Last Opened',
    created: 'Created',
    modified: 'Modified',
    size: 'Size',
    tag: 'Tag',
};

function GridLayout({ nodes, iconSize, cellSize, sortMode, selectedIds, onNodeClick, onNodeDoubleClick, onNodeSelect, onContextMenu }: GridLayoutProps) {
    const handleBackgroundMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onNodeSelect?.([], false);
        }
    }, [onNodeSelect]);

    return (
        <Box>
            <Box sx={{ px: `${CELL_GAP_PX}px`, pt: `${CELL_GAP_PX}px`, pb: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Sorted by: {SORT_MODE_LABELS[sortMode] ?? sortMode}
                </Typography>
            </Box>
            <Box
                onMouseDown={handleBackgroundMouseDown}
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
                        isSelected={selectedIds?.has(node.id) ?? false}
                        onClick={onNodeClick}
                        onDoubleClick={onNodeDoubleClick}
                        onSelect={onNodeSelect}
                        onContextMenu={onContextMenu}
                    />
                ))}
            </Box>
        </Box>
    );
}

// -- Free Layout (unsorted mode, grid-snapped absolute positioning) --

interface FreeLayoutProps {
    nodes: TreeNodeInUI[];
    iconSize: number;
    cellSize: { width: number; height: number };
    selectedIds?: Set<string>;
    onIconPositionChange: (nodeId: NodeId, position: { x: number; y: number }) => void;
    onNodeClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
    onNodeDoubleClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
    onNodeSelect?: (nodeIds: string[], selected: boolean) => void;
    onContextMenu?: (node: TreeNodeInUI, position: { left: number; top: number }) => void;
}

function FreeLayout({
    nodes,
    iconSize,
    cellSize,
    selectedIds,
    onIconPositionChange,
    onNodeClick,
    onNodeDoubleClick,
    onNodeSelect,
    onContextMenu,
}: FreeLayoutProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const containerCols = 6;

    // Compute initial positions from node data
    const basePositions = useMemo(
        () => assignInitialPositions(nodes, containerCols),
        [nodes, containerCols],
    );

    // Local mutable position state that updates immediately on drag end
    const [localPositions, setLocalPositions] = useState<Map<string, { col: number; row: number }>>(
        () => new Map(basePositions),
    );

    // Merge new nodes from basePositions without overwriting existing local positions
    useEffect(() => {
        setLocalPositions((prev) => {
            let changed = false;
            const next = new Map(prev);
            // Add positions for new nodes
            for (const [id, pos] of basePositions) {
                if (!next.has(id)) {
                    next.set(id, pos);
                    changed = true;
                }
            }
            // Remove positions for deleted nodes
            for (const id of prev.keys()) {
                if (!basePositions.has(id)) {
                    next.delete(id);
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [basePositions]);

    // Build occupied set from local positions
    const occupiedSet = useMemo(() => {
        const set = new Set<string>();
        for (const [, pos] of localPositions) {
            set.add(`${pos.col},${pos.row}`);
        }
        return set;
    }, [localPositions]);

    // Handle drag end: update local state immediately, then persist
    const handleDragEnd = useCallback((nodeId: NodeId, position: { x: number; y: number }) => {
        setLocalPositions((prev) => {
            const next = new Map(prev);
            next.set(nodeId, { col: position.x, row: position.y });
            return next;
        });
        onIconPositionChange(nodeId, position);
    }, [onIconPositionChange]);

    // Persist initial positions for nodes that didn't have one
    const persistedRef = useRef(new Set<string>());
    useEffect(() => {
        for (const node of nodes) {
            if (!node.viewProperties?.iconPosition && !persistedRef.current.has(node.id)) {
                const pos = localPositions.get(node.id);
                if (pos) {
                    persistedRef.current.add(node.id);
                    onIconPositionChange(node.id, { x: pos.col, y: pos.row });
                }
            }
        }
    }, [nodes, localPositions, onIconPositionChange]);

    const handleBackgroundMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onNodeSelect?.([], false);
        }
    }, [onNodeSelect]);

    // Calculate container min height from node positions
    const containerMinHeight = useMemo(() => {
        let maxRow = 0;
        for (const [, pos] of localPositions) {
            if (pos.row > maxRow) maxRow = pos.row;
        }
        return gridToPixel(0, maxRow + 1, cellSize.width, cellSize.height).py + cellSize.height;
    }, [localPositions, cellSize]);

    return (
        <Box
            ref={containerRef}
            onMouseDown={handleBackgroundMouseDown}
            sx={{
                position: 'relative',
                width: '100%',
                minHeight: containerMinHeight,
            }}
        >
            {nodes.map((node) => {
                const gridPos = localPositions.get(node.id) ?? { col: 0, row: 0 };
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
                        isSelected={selectedIds?.has(node.id) ?? false}
                        occupiedSet={occupiedSet}
                        onDragEnd={handleDragEnd}
                        onClick={onNodeClick}
                        onDoubleClick={onNodeDoubleClick}
                        onSelect={onNodeSelect}
                        onContextMenu={onContextMenu}
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
    isSelected: boolean;
    onClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
    onDoubleClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
    onSelect?: (nodeIds: string[], selected: boolean) => void;
    onContextMenu?: (node: TreeNodeInUI, position: { left: number; top: number }) => void;
}

function IconCell({ node, iconSize, cellWidth, isSelected, onClick, onDoubleClick, onSelect, onContextMenu }: IconCellProps) {
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const longPressTriggeredRef = useRef(false);

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (longPressTriggeredRef.current) {
            longPressTriggeredRef.current = false;
            return;
        }
        e.stopPropagation();
        onSelect?.([node.id], true);
        onClick?.(node.id, node);
    }, [onClick, onSelect, node]);

    const handleDoubleClick = useCallback(() => {
        onDoubleClick?.(node.id, node);
    }, [onDoubleClick, node]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect?.([node.id], true);
        onContextMenu?.(node, { left: e.clientX, top: e.clientY });
    }, [onSelect, onContextMenu, node]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        longPressTriggeredRef.current = false;
        longPressTimerRef.current = setTimeout(() => {
            longPressTriggeredRef.current = true;
            onSelect?.([node.id], true);
            onContextMenu?.(node, { left: e.clientX, top: e.clientY });
        }, 500);
    }, [onSelect, onContextMenu, node]);

    const handlePointerUp = useCallback(() => {
        if (longPressTimerRef.current !== undefined) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = undefined;
        }
    }, []);

    return (
        <Box
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: cellWidth,
                cursor: 'pointer',
                userSelect: 'none',
                borderRadius: 1,
                backgroundColor: isSelected ? 'action.selected' : 'transparent',
                '&:hover': { backgroundColor: isSelected ? 'action.selected' : 'action.hover' },
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
                    htmlColor={resolveIconColor(node)}
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
    isSelected: boolean;
    occupiedSet: Set<string>;
    onDragEnd: (nodeId: NodeId, position: { x: number; y: number }) => void;
    onClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
    onDoubleClick?: (nodeId: NodeId, node: TreeNodeInUI) => void;
    onSelect?: (nodeIds: string[], selected: boolean) => void;
    onContextMenu?: (node: TreeNodeInUI, position: { left: number; top: number }) => void;
}

function DraggableIconCell({
    node,
    iconSize,
    cellSize,
    initialPx,
    initialPy,
    gridCol,
    gridRow,
    isSelected,
    occupiedSet,
    onDragEnd,
    onClick,
    onDoubleClick,
    onSelect,
    onContextMenu,
}: DraggableIconCellProps) {
    const dragRef = useRef<{ startX: number; startY: number; origPx: number; origPy: number } | null>(null);
    const elementRef = useRef<HTMLDivElement | null>(null);
    const movedRef = useRef(false);
    const isDraggingRef = useRef(false);

    // Sync DOM position when zoom changes (initialPx/initialPy update)
    useEffect(() => {
        if (!isDraggingRef.current && elementRef.current) {
            elementRef.current.style.left = `${initialPx}px`;
            elementRef.current.style.top = `${initialPy}px`;
        }
    }, [initialPx, initialPy]);

    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const longPressTriggeredRef = useRef(false);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        isDraggingRef.current = true;
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origPx: initialPx,
            origPy: initialPy,
        };
        movedRef.current = false;
        longPressTriggeredRef.current = false;
        const clientX = e.clientX;
        const clientY = e.clientY;
        longPressTimerRef.current = setTimeout(() => {
            longPressTriggeredRef.current = true;
            isDraggingRef.current = false;
            dragRef.current = null;
            if (elementRef.current) {
                try { elementRef.current.releasePointerCapture(e.pointerId); } catch { /* already released */ }
            }
            onSelect?.([node.id], true);
            onContextMenu?.(node, { left: clientX, top: clientY });
        }, 500);
    }, [initialPx, initialPy, onSelect, onContextMenu, node]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        if (longPressTimerRef.current !== undefined) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = undefined;
        }
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            movedRef.current = true;
        }
        const newPx = drag.origPx + dx;
        const newPy = drag.origPy + dy;
        if (elementRef.current) {
            elementRef.current.style.left = `${newPx}px`;
            elementRef.current.style.top = `${newPy}px`;
        }
    }, []);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (longPressTimerRef.current !== undefined) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = undefined;
        }
        if (longPressTriggeredRef.current) {
            isDraggingRef.current = false;
            dragRef.current = null;
            return;
        }
        if (dragRef.current && movedRef.current) {
            const drag = dragRef.current;
            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;
            const finalPx = drag.origPx + dx;
            const finalPy = drag.origPy + dy;
            // Snap to grid
            const { col, row } = pixelToGrid(finalPx, finalPy, cellSize.width, cellSize.height);
            // Collision avoidance: exclude self from occupied set
            const othersOccupied = new Set(occupiedSet);
            othersOccupied.delete(`${gridCol},${gridRow}`);
            const free = findNearestFreeCell(col, row, othersOccupied);
            // Snap to the resolved grid position
            const snapped = gridToPixel(free.col, free.row, cellSize.width, cellSize.height);
            if (elementRef.current) {
                elementRef.current.style.left = `${snapped.px}px`;
                elementRef.current.style.top = `${snapped.py}px`;
            }
            // Persist grid coordinates (not pixels)
            onDragEnd(node.id, { x: free.col, y: free.row });
        }
        isDraggingRef.current = false;
        dragRef.current = null;
    }, [node.id, onDragEnd, cellSize, occupiedSet, gridCol, gridRow]);

    const handleLostPointerCapture = useCallback(() => {
        if (longPressTimerRef.current !== undefined) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = undefined;
        }
        if (isDraggingRef.current && dragRef.current && !movedRef.current) {
            // Pointer capture lost without completing drag — reset
            isDraggingRef.current = false;
            dragRef.current = null;
        }
    }, []);

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (!movedRef.current && !longPressTriggeredRef.current) {
            e.stopPropagation();
            onSelect?.([node.id], true);
            onClick?.(node.id, node);
        }
        longPressTriggeredRef.current = false;
    }, [onClick, onSelect, node]);

    const handleDoubleClick = useCallback(() => {
        onDoubleClick?.(node.id, node);
    }, [onDoubleClick, node]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect?.([node.id], true);
        onContextMenu?.(node, { left: e.clientX, top: e.clientY });
    }, [onSelect, onContextMenu, node]);

    return (
        <Box
            ref={elementRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onLostPointerCapture={handleLostPointerCapture}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
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
                borderRadius: 1,
                backgroundColor: isSelected ? 'action.selected' : 'transparent',
                '&:hover': { backgroundColor: isSelected ? 'action.selected' : 'action.hover' },
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
                    htmlColor={resolveIconColor(node)}
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
