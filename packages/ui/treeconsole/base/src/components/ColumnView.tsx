/**
 * ColumnView — hierarchical column navigation (Finder / Smalltalk class browser style).
 *
 * Flex layout with fixed-width columns, shrink-to-fit, horizontal scroll,
 * and draggable resize handles between columns.
 */

import { useCallback, useRef, useState } from 'react';
import { Box, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import { NodeTypeIcon } from '@hierarchidb/components';
import { getPluginIconColor, isFolderNodeType } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { rainbowColors } from '@hierarchidb/ui-theme';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNodeInUI } from '@hierarchidb/ui-treeconsole-treetable';
import type { ColumnViewState } from '~/hooks/useColumnView';

const DEFAULT_COLUMN_WIDTH = 480;
const MIN_COLUMN_WIDTH = 120;
const HANDLE_WIDTH = 4;

export interface ColumnViewProps {
    rootNodes: TreeNodeInUI[];
    columnState: ColumnViewState;
    onSelectNode: (nodeId: NodeId) => void;
    getChildren: (nodeId: NodeId) => TreeNodeInUI[];
    onIconContextMenu?: (node: TreeNodeInUI, position: { left: number; top: number }) => void;
    /** Callback when user right-clicks the background of a column. Receives the folder ID the column represents. */
    onBackgroundContextMenu?: (folderId: NodeId, position: { left: number; top: number }) => void;
    /** The root folder ID for the first column. */
    rootFolderId?: NodeId;
    /** Optional detail panel rendered as the last column (e.g. for non-folder target nodes). */
    detailSlot?: React.ReactNode;
}

function resolveIconColor(node: TreeNodeInUI): string {
    const nodeType = String(node.nodeType ?? 'folder');
    const depth = node.depth ?? 0;
    const baseColor = rainbowColors[Math.max(0, depth) % rainbowColors.length] ?? '#888';
    if (isFolderNodeType(nodeType)) return baseColor;
    return getPluginIconColor(nodeType) ?? baseColor;
}

export function ColumnView({
    rootNodes,
    columnState,
    onSelectNode,
    getChildren,
    onIconContextMenu,
    onBackgroundContextMenu,
    rootFolderId,
    detailSlot,
}: ColumnViewProps) {
    const columns: TreeNodeInUI[][] = [rootNodes];
    for (const pathNodeId of columnState.expandedPath) {
        const children = getChildren(pathNodeId);
        if (children.length > 0) {
            columns.push(children);
        }
    }

    // Per-column widths (indexed by column position)
    const [columnWidths, setColumnWidths] = useState<number[]>([]);

    const getWidth = (index: number) => columnWidths[index] ?? DEFAULT_COLUMN_WIDTH;

    // Resolve the folder ID each column represents
    const getColumnFolderId = (colIndex: number): NodeId | undefined => {
        if (colIndex === 0) return rootFolderId;
        return columnState.expandedPath[colIndex - 1];
    };

    return (
        <Box sx={{ height: '100%', width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
            <Box sx={{ display: 'flex', height: '100%', width: 'fit-content', minWidth: '100%' }}>
                {columns.map((nodes, colIndex) => (
                    <ColumnWithHandle
                        key={colIndex}
                        colIndex={colIndex}
                        width={getWidth(colIndex)}
                        isLast={colIndex === columns.length - 1}
                        onResize={(newWidth) => {
                            setColumnWidths((prev) => {
                                const next = [...prev];
                                while (next.length <= colIndex) next.push(DEFAULT_COLUMN_WIDTH);
                                next[colIndex] = Math.max(MIN_COLUMN_WIDTH, newWidth);
                                return next;
                            });
                        }}
                    >
                        <Column
                            nodes={nodes}
                            folderId={getColumnFolderId(colIndex)}
                            selectedNodeId={columnState.selectedNodeId}
                            expandedPath={columnState.expandedPath}
                            onSelectNode={onSelectNode}
                            onIconContextMenu={onIconContextMenu}
                            onBackgroundContextMenu={onBackgroundContextMenu}
                        />
                    </ColumnWithHandle>
                ))}
                {detailSlot && (
                    <Box sx={{
                        flexShrink: 0,
                        height: '100%',
                        minWidth: DEFAULT_COLUMN_WIDTH,
                        overflow: 'auto',
                        display: 'flex',
                        alignItems: 'flex-start',
                    }}>
                        {detailSlot}
                    </Box>
                )}
            </Box>
        </Box>
    );
}

// -- Column with resize handle --

interface ColumnWithHandleProps {
    colIndex: number;
    width: number;
    isLast: boolean;
    onResize: (newWidth: number) => void;
    children: React.ReactNode;
}

function ColumnWithHandle({ width, isLast, onResize, children }: ColumnWithHandleProps) {
    const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = { startX: e.clientX, startWidth: width };
    }, [width]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = e.clientX - drag.startX;
        onResize(drag.startWidth + dx);
    }, [onResize]);

    const handlePointerUp = useCallback(() => {
        dragRef.current = null;
    }, []);

    return (
        <Box sx={{ display: 'flex', flexShrink: 0, height: '100%' }}>
            <Box sx={{ width, minWidth: MIN_COLUMN_WIDTH, height: '100%', overflow: 'hidden' }}>
                {children}
            </Box>
            {!isLast && (
                <Box
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    sx={{
                        width: HANDLE_WIDTH,
                        cursor: 'col-resize',
                        backgroundColor: 'divider',
                        flexShrink: 0,
                        '&:hover': { backgroundColor: 'action.hover' },
                        touchAction: 'none',
                    }}
                />
            )}
        </Box>
    );
}

// -- Column content --

interface ColumnProps {
    nodes: TreeNodeInUI[];
    folderId?: NodeId;
    selectedNodeId: NodeId | null;
    expandedPath: NodeId[];
    onSelectNode: (nodeId: NodeId) => void;
    onIconContextMenu?: (node: TreeNodeInUI, position: { left: number; top: number }) => void;
    onBackgroundContextMenu?: (folderId: NodeId, position: { left: number; top: number }) => void;
}

function Column({ nodes, folderId, selectedNodeId, expandedPath, onSelectNode, onIconContextMenu, onBackgroundContextMenu }: ColumnProps) {
    const handleContextMenu = useCallback((event: React.MouseEvent) => {
        // Only fire when clicking empty space (not on list items)
        const target = event.target as HTMLElement;
        if (target.closest('.MuiListItemButton-root')) return;

        event.preventDefault();
        if (folderId && onBackgroundContextMenu) {
            onBackgroundContextMenu(folderId, { left: event.clientX, top: event.clientY });
        }
    }, [folderId, onBackgroundContextMenu]);

    return (
        <Box
            onContextMenu={handleContextMenu}
            sx={{
                height: '100%',
                overflowY: 'auto',
                overflowX: 'hidden',
                backgroundColor: 'background.paper',
            }}
        >
            <List dense disablePadding sx={{ py: 0 }}>
                {nodes.map((node) => (
                    <ColumnItem
                        key={node.id}
                        node={node}
                        isSelected={node.id === selectedNodeId}
                        isExpanded={expandedPath.includes(node.id)}
                        onSelect={onSelectNode}
                        onIconContextMenu={onIconContextMenu}
                    />
                ))}
            </List>
        </Box>
    );
}

// -- Column item --

interface ColumnItemProps {
    node: TreeNodeInUI;
    isSelected: boolean;
    isExpanded: boolean;
    onSelect: (nodeId: NodeId) => void;
    onIconContextMenu?: (node: TreeNodeInUI, position: { left: number; top: number }) => void;
}

function ColumnItem({ node, isSelected, isExpanded, onSelect, onIconContextMenu }: ColumnItemProps) {
    const handleClick = useCallback(() => onSelect(node.id), [onSelect, node.id]);
    const showChevron = node.hasChildren;
    const isDraft = (node as { version?: number }).version === 0;
    const buildRequired = node.metadata?.buildMetadata?.buildRequired ?? false;

    const handleIconClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onIconContextMenu?.(node, { left: e.clientX, top: e.clientY });
    }, [onIconContextMenu, node]);

    return (
        <ListItemButton
            selected={isSelected || isExpanded}
            onClick={handleClick}
            sx={{
                py: 0.25,
                px: 1,
                minHeight: 28,
                '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { backgroundColor: 'primary.dark' },
                    '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                    '& .MuiSvgIcon-root': { color: 'primary.contrastText' },
                },
            }}
        >
            <ListItemIcon
                sx={{ minWidth: 24, mr: 0.5, cursor: 'context-menu' }}
                onClick={handleIconClick}
            >
                <NodeTypeIcon
                    nodeType={node.nodeType}
                    size="small"
                    htmlColor={isSelected || isExpanded ? undefined : resolveIconColor(node)}
                    isDraft={isDraft}
                    buildRequired={buildRequired}
                />
            </ListItemIcon>
            <ListItemText
                primary={node.metadata.name}
                primaryTypographyProps={{
                    variant: 'body2',
                    noWrap: true,
                    fontSize: '0.8125rem',
                }}
            />
            {showChevron && (
                <ChevronRight
                    sx={{
                        fontSize: 16,
                        ml: 0.5,
                        opacity: 0.6,
                        flexShrink: 0,
                    }}
                />
            )}
        </ListItemButton>
    );
}
