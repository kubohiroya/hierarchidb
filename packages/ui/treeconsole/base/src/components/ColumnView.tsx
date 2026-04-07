/**
 * ColumnView — hierarchical column navigation (Finder / Smalltalk class browser style).
 */

import { useCallback } from 'react';
import { Box, IconButton, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { NodeTypeIcon } from '@hierarchidb/components';
import { getPluginIconColor, isFolderNodeType } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { rainbowColors } from '@hierarchidb/ui-theme';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNodeInUI } from '@hierarchidb/ui-treeconsole-treetable';
import type { ColumnViewState } from '~/hooks/useColumnView';

export interface ColumnViewProps {
    rootNodes: TreeNodeInUI[];
    columnState: ColumnViewState;
    onSelectNode: (nodeId: NodeId) => void;
    getChildren: (nodeId: NodeId) => TreeNodeInUI[];
    onIconContextMenu?: (node: TreeNodeInUI, position: { left: number; top: number }) => void;
}

function resolveIconColor(node: TreeNodeInUI): string {
    const nodeType = String(node.nodeType ?? 'folder');
    const depth = node.depth ?? 0;
    const baseColor = rainbowColors[Math.max(0, depth) % rainbowColors.length];
    if (isFolderNodeType(nodeType)) return baseColor;
    return getPluginIconColor(nodeType) ?? baseColor;
}

export function ColumnView({
    rootNodes,
    columnState,
    onSelectNode,
    getChildren,
    onIconContextMenu,
}: ColumnViewProps) {
    const columns: TreeNodeInUI[][] = [rootNodes];
    for (const pathNodeId of columnState.expandedPath) {
        const children = getChildren(pathNodeId);
        if (children.length > 0) {
            columns.push(children);
        }
    }

    return (
        <Box sx={{ height: '100%', width: '100%', display: 'flex' }}>
            <Allotment>
                {columns.map((nodes, colIndex) => (
                    <Allotment.Pane key={colIndex} minSize={240} preferredSize={480}>
                        <Column
                            nodes={nodes}
                            selectedNodeId={columnState.selectedNodeId}
                            expandedPath={columnState.expandedPath}
                            onSelectNode={onSelectNode}
                            onIconContextMenu={onIconContextMenu}
                        />
                    </Allotment.Pane>
                ))}
            </Allotment>
        </Box>
    );
}

interface ColumnProps {
    nodes: TreeNodeInUI[];
    selectedNodeId: NodeId | null;
    expandedPath: NodeId[];
    onSelectNode: (nodeId: NodeId) => void;
    onIconContextMenu?: (node: TreeNodeInUI, position: { left: number; top: number }) => void;
}

function Column({ nodes, selectedNodeId, expandedPath, onSelectNode, onIconContextMenu }: ColumnProps) {
    return (
        <Box
            sx={{
                height: '100%',
                overflow: 'auto',
                borderRight: 1,
                borderColor: 'divider',
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
