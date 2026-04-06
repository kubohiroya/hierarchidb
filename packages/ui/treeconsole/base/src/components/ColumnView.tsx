/**
 * ColumnView — hierarchical column navigation (Smalltalk class browser style).
 *
 * Each column displays children of the corresponding node in expandedPath.
 * Selecting a node with children adds a new column to the right.
 * Uses allotment for resizable pane splitting.
 */

import { useCallback } from 'react';
import { Box, List, ListItemButton, ListItemText } from '@mui/material';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNodeInUI } from '@hierarchidb/ui-treeconsole-treetable';
import type { ColumnViewState } from '~/hooks/useColumnView';

export interface ColumnViewProps {
    /** Root-level nodes (column 0). */
    rootNodes: TreeNodeInUI[];
    /** Current column state from useColumnView. */
    columnState: ColumnViewState;
    /** Called when user selects a node. */
    onSelectNode: (nodeId: NodeId) => void;
    /** Resolve children for a given node ID. */
    getChildren: (nodeId: NodeId) => TreeNodeInUI[];
}

export function ColumnView({
    rootNodes,
    columnState,
    onSelectNode,
    getChildren,
}: ColumnViewProps) {
    // Build columns: column 0 = rootNodes, column i = children of expandedPath[i-1]
    const columns: TreeNodeInUI[][] = [rootNodes];
    for (const pathNodeId of columnState.expandedPath) {
        const children = getChildren(pathNodeId);
        if (children.length > 0) {
            columns.push(children);
        }
    }

    return (
        <Box sx={{ height: '100%', width: '100%' }}>
            <Allotment>
                {columns.map((nodes, colIndex) => (
                    <Allotment.Pane key={colIndex} minSize={150} preferredSize={250}>
                        <Column
                            nodes={nodes}
                            selectedNodeId={columnState.selectedNodeId}
                            expandedPath={columnState.expandedPath}
                            onSelectNode={onSelectNode}
                        />
                    </Allotment.Pane>
                ))}
            </Allotment>
        </Box>
    );
}

// -- Single Column --

interface ColumnProps {
    nodes: TreeNodeInUI[];
    selectedNodeId: NodeId | null;
    expandedPath: NodeId[];
    onSelectNode: (nodeId: NodeId) => void;
}

function Column({ nodes, selectedNodeId, expandedPath, onSelectNode }: ColumnProps) {
    return (
        <Box
            sx={{
                height: '100%',
                overflow: 'auto',
                borderRight: 1,
                borderColor: 'divider',
            }}
        >
            <List dense disablePadding>
                {nodes.map((node) => (
                    <ColumnItem
                        key={node.id}
                        node={node}
                        isSelected={node.id === selectedNodeId}
                        isExpanded={expandedPath.includes(node.id)}
                        onSelect={onSelectNode}
                    />
                ))}
            </List>
        </Box>
    );
}

// -- Column Item --

interface ColumnItemProps {
    node: TreeNodeInUI;
    isSelected: boolean;
    isExpanded: boolean;
    onSelect: (nodeId: NodeId) => void;
}

function ColumnItem({ node, isSelected, isExpanded, onSelect }: ColumnItemProps) {
    const handleClick = useCallback(() => onSelect(node.id), [onSelect, node.id]);

    return (
        <ListItemButton
            selected={isSelected || isExpanded}
            onClick={handleClick}
            sx={{ py: 0.5 }}
        >
            <ListItemText
                primary={node.metadata.name}
                primaryTypographyProps={{ variant: 'body2', noWrap: true }}
            />
            {node.hasChildren && (
                <Box component="span" sx={{ color: 'text.secondary', ml: 1 }}>›</Box>
            )}
        </ListItemButton>
    );
}
