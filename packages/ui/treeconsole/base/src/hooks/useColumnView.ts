/**
 * Headless hook for ColumnView state management.
 *
 * Provides a TanStack Table expandable API-compatible shape
 * (getIsExpanded, toggleExpanded, getCanExpand) plus column-specific
 * path management for hierarchical column navigation.
 */

import { useCallback, useMemo, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNodeInUI } from '@hierarchidb/ui-treeconsole-treetable';

export interface ColumnViewState {
    /** Ordered chain of expanded node IDs from root to deepest visible column. */
    expandedPath: NodeId[];
    /** Currently selected node (highlighted in its column). */
    selectedNodeId: NodeId | null;
}

export interface ColumnViewAPI {
    // TanStack Table expandable API compatible shape
    getIsExpanded: (nodeId: NodeId) => boolean;
    toggleExpanded: (nodeId: NodeId) => void;
    getCanExpand: (nodeId: NodeId) => boolean;

    // Column-specific
    columnPath: NodeId[];
    selectedNodeId: NodeId | null;

    /** Select a node: if it has children, append to path; if leaf, truncate. */
    selectNode: (nodeId: NodeId) => void;
}

interface UseColumnViewArgs {
    /** All nodes keyed for child lookup. */
    getChildren: (nodeId: NodeId) => TreeNodeInUI[];
    /** Check if a node has children. */
    hasChildren: (nodeId: NodeId) => boolean;
    /** Initial state. */
    initialState?: ColumnViewState;
}

const DEFAULT_STATE: ColumnViewState = {
    expandedPath: [],
    selectedNodeId: null,
};

export function useColumnView({
    getChildren,
    hasChildren,
    initialState = DEFAULT_STATE,
}: UseColumnViewArgs): ColumnViewAPI {
    const [state, setState] = useState<ColumnViewState>(initialState);

    const expandedSet = useMemo(
        () => new Set(state.expandedPath),
        [state.expandedPath],
    );

    const getIsExpanded = useCallback(
        (nodeId: NodeId) => expandedSet.has(nodeId),
        [expandedSet],
    );

    const getCanExpand = useCallback(
        (nodeId: NodeId) => hasChildren(nodeId),
        [hasChildren],
    );

    const toggleExpanded = useCallback(
        (nodeId: NodeId) => {
            setState((prev) => {
                const idx = prev.expandedPath.indexOf(nodeId);
                if (idx >= 0) {
                    // Collapse: truncate path up to (not including) this node
                    return {
                        ...prev,
                        expandedPath: prev.expandedPath.slice(0, idx),
                    };
                }
                // Expand: append (guard against circular references)
                if (prev.expandedPath.includes(nodeId)) return prev;
                return {
                    ...prev,
                    expandedPath: [...prev.expandedPath, nodeId],
                };
            });
        },
        [],
    );

    const selectNode = useCallback(
        (nodeId: NodeId) => {
            setState((prev) => {
                const path = prev.expandedPath;

                // Guard against circular references
                if (path.includes(nodeId)) {
                    return { ...prev, selectedNodeId: nodeId };
                }

                // Find which column this node belongs to by checking if it's
                // a child of any node in the current expandedPath.
                let parentIdx = -1;
                for (let i = 0; i < path.length; i++) {
                    const parentId = path[i];
                    if (parentId === undefined) continue;
                    const siblings = getChildren(parentId);
                    if (siblings.some((s) => s.id === nodeId)) {
                        parentIdx = i;
                        break;
                    }
                }

                // truncateAt = index after the parent, or 0 if node is a root
                const truncateAt = parentIdx >= 0 ? parentIdx + 1 : 0;

                if (hasChildren(nodeId)) {
                    // Node has children: truncate and append
                    return {
                        expandedPath: [...path.slice(0, truncateAt), nodeId],
                        selectedNodeId: nodeId,
                    };
                }

                // Leaf node: truncate path (don't append the leaf itself)
                return {
                    expandedPath: path.slice(0, truncateAt),
                    selectedNodeId: nodeId,
                };
            });
        },
        [getChildren, hasChildren],
    );

    return {
        getIsExpanded,
        toggleExpanded,
        getCanExpand,
        columnPath: state.expandedPath,
        selectedNodeId: state.selectedNodeId,
        selectNode,
    };
}
