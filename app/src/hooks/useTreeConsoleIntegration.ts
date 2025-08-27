/**
 * useTreeConsoleIntegration Hook
 *
 * Manages TreeConsole state and interactions with WorkerAPIClient.
 * Avoids Orchestrated APIs and uses direct Worker API calls.
 */

import { useState, useEffect, useMemo } from 'react';
import type { NodeId, TreeId, TreeNode } from '@hierarchidb/common-core';
import type { Remote } from 'comlink';
import type WorkerModule from '~/worker';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import type { BreadcrumbNode } from '@hierarchidb/ui-treeconsole-breadcrumb';
// import { useImportExport } from '@hierarchidb/feature-import-export-plugin'; // TODO: Implement this hook
import { convertTreeNodeToTreeNodeData, createDefaultColumns } from '../utils/treeNodeConverter';

export interface UseTreeConsoleIntegrationParams {
  client: Remote<typeof WorkerModule>;
  treeId?: string;
  pageNodeId?: NodeId;
  pageTreeNode?: TreeNode;
}

export interface TreeConsoleState {
  loading: boolean;
  error: string | null;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filterBy?: string;
  availableFilters: string[];
  canGoBack: boolean;
  canGoForward: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
}

export interface TreeConsoleActions {
  handleNodeClick: (node: TreeNodeData) => void;
  handleNodeSelect: (nodeId: string, selected: boolean) => void;
  handleNodeExpand: (nodeId: string, expanded: boolean) => void;
  handleSearchChange: (term: string) => void;
  handleSearchClear: () => void;
  handleCreate: () => void;
  handleEdit: () => void;
  handleDelete: () => void;
  handleRefresh: () => void;
  handleExpandAll: () => void;
  handleCollapseAll: () => void;
  handleSort: (columnId: string) => void;
  handleFilterChange: (filter: string) => void;
  handleViewModeChange: (mode: 'list' | 'grid') => void;
  handleBreadcrumbNavigate: (nodeId: string, node?: BreadcrumbNode) => void;
  handleNavigateBack: () => void;
  handleNavigateForward: () => void;
  handleContextMenuAction: (action: string, node: TreeNodeData) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleCopy: () => void;
  handlePaste: () => void;
  handleDuplicate: () => void;
  handleImport: () => void;
  handleExport: () => void;
}

export function useTreeConsoleIntegration({
  client,
  treeId,
  pageNodeId,
  pageTreeNode,
}: UseTreeConsoleIntegrationParams) {

  // Tree data state
  const [treeData, setTreeData] = useState<TreeNodeData[]>([]);
  const [selectedIds, setSelectedIds] = useState<NodeId[]>([]);
  const [expandedIds, setExpandedIds] = useState<NodeId[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // TreeConsole internal state
  const [state, setState] = useState<TreeConsoleState>({
    loading: false,
    error: null,
    sortBy: 'name',
    sortDirection: 'asc',
    filterBy: '',
    availableFilters: ['folder', 'basemap', '_shapes_buggy'],
    canGoBack: false,
    canGoForward: false,
    canUndo: false,
    canRedo: false,
    canPaste: false,
  });

  // Memoized columns configuration
  const columns = useMemo(() => createDefaultColumns(), []);

  // Memoized breadcrumb items
  const breadcrumbItems = useMemo<BreadcrumbNode[]>(() => {
    if (!pageTreeNode) return [];

    return [
      {
        id: pageTreeNode.id,
        name: pageTreeNode.name,
        nodeType: pageTreeNode.nodeType,
      },
    ];
  }, [pageTreeNode]);

  // Import/Export functionality from ui-import-export
  // TODO: Implement useImportExport hook
  const handleExport = async (format: string) => {
    console.log(`Export functionality not implemented yet for format: ${format}`);
  };

  // Actions implementation
  const actions = useMemo<TreeConsoleActions>(
    () => ({
      handleNodeClick: (node: TreeNodeData) => {
        console.log('Node clicked:', node);
        // TODO: Navigate to node or perform action based on node type
        // Avoiding Orchestrated APIs as requested
      },

      handleNodeSelect: (nodeId: string, selected: boolean) => {
        setSelectedIds((prev) => {
          if (selected) {
            return [...new Set([...prev, nodeId as NodeId])];
          } else {
            return prev.filter((id) => id !== nodeId);
          }
        });
      },

      handleNodeExpand: async (nodeId: string, expanded: boolean) => {
        setExpandedIds((prev) => {
          if (expanded) {
            return [...new Set([...prev, nodeId as NodeId])];
          } else {
            return prev.filter((id) => id !== nodeId);
          }
        });

        // Load children when expanding (if not already loaded)
        if (expanded && client) {
          try {
            const children = await client.getChildren(nodeId);

            // Update tree data with children
            setTreeData((prev) => {
              const updated = [...prev];
              const parentIndex = updated.findIndex((node) => node.id === nodeId);
              if (parentIndex >= 0) {
                const currentNode = updated[parentIndex];
                if (currentNode?.id) {
                  updated[parentIndex] = {
                    ...currentNode,
                    children: children.map((child) => convertTreeNodeToTreeNodeData(child)),
                  };
                }
              }
              return updated;
            });
          } catch (err) {
            console.error('Failed to load children for node:', nodeId, err);
          }
        }
      },

      handleSearchChange: (term: string) => {
        setSearchTerm(term);
        // TODO: Implement search functionality using Worker API
        // Avoiding Orchestrated APIs as requested
      },

      handleSearchClear: () => {
        setSearchTerm('');
      },

      handleCreate: () => {
        console.log('Create action triggered');
        // Simple folder creation implementation for E2E testing
        const folderName = prompt('Enter folder name:');
        if (folderName && folderName.trim()) {
          console.log('Creating folder:', folderName.trim());
          // For E2E testing purposes, we'll use a simple prompt
          // In a real implementation, this would open a proper dialog
        }
      },

      handleEdit: () => {
        console.log('Edit action triggered for:', selectedIds);
        // TODO: Implement edit functionality
        // Avoiding Orchestrated APIs as requested
      },

      handleDelete: () => {
        console.log('Delete action triggered for:', selectedIds);
        // TODO: Implement delete functionality
        // Avoiding Orchestrated APIs as requested
      },

      handleRefresh: async () => {
        if (!client || !pageNodeId) return;

        setState((prev) => ({ ...prev, loading: true }));
        try {
          const children = await client.getChildren(pageNodeId as string);
          const treeNodeData = children.map(convertTreeNodeToTreeNodeData);
          setTreeData(treeNodeData);
        } catch (err) {
          console.error('Failed to refresh tree data:', err);
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err.message : String(err),
          }));
        } finally {
          setState((prev) => ({ ...prev, loading: false }));
        }
      },

      handleExpandAll: () => {
        const allIds = treeData.map((node) => node.id);
        setExpandedIds(allIds);
      },

      handleCollapseAll: () => {
        setExpandedIds([]);
      },

      handleSort: (columnId: string) => {
        setState((prev) => ({
          ...prev,
          sortBy: columnId,
          sortDirection: prev.sortBy === columnId && prev.sortDirection === 'asc' ? 'desc' : 'asc',
        }));
      },

      handleFilterChange: (filter: string) => {
        setState((prev) => ({ ...prev, filterBy: filter }));
      },

      handleViewModeChange: (mode: 'list' | 'grid') => {
        setViewMode(mode);
      },

      handleBreadcrumbNavigate: (nodeId: string, node?: BreadcrumbNode) => {
        console.log('Breadcrumb navigate to:', nodeId, node);
        // TODO: Implement navigation
      },

      handleNavigateBack: () => {
        console.log('Navigate back');
        // TODO: Implement back navigation
      },

      handleNavigateForward: () => {
        console.log('Navigate forward');
        // TODO: Implement forward navigation
      },

      handleContextMenuAction: async (action: string, node: TreeNodeData) => {
        console.log('Context menu action:', action, 'for node:', node);

        // Handle creation actions from SpeedDial
        if (action.startsWith('create:')) {
          const nodeType = action.replace('create:', '');
          console.log('Creating node of type:', nodeType);

          try {
            // Use the worker API to create a new node
            if (client && pageNodeId) {
              // Generate a user-friendly name based on the node type
              const displayName = nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
              
              const result = await client.create({
                nodeType: nodeType,
                treeId: treeId || ('default-tree' as TreeId),
                parentId: pageNodeId as NodeId,
                name: `New ${displayName}`,
                description: '',
              });

              if (result.success) {
                console.log('Node created successfully:', result.nodeId);
                // Refresh the tree data
                if (client && pageNodeId) {
                  try {
                    const children = await client.getChildren(pageNodeId as string);
                    const treeNodeData = children.map(convertTreeNodeToTreeNodeData);
                    setTreeData(treeNodeData);
                  } catch (refreshError) {
                    console.error('Failed to refresh after creation:', refreshError);
                  }
                }
              } else {
                console.error('Failed to create node:', result.error);
                // TODO: Show error notification to user
              }
            }
          } catch (error) {
            console.error('Error creating node:', error);
            // TODO: Show error notification to user
          }
          return;
        }

        // Handle import/export through context menu
        if (action === 'export' && node?.id) {
          await handleExport('json');
        }
        // TODO: Implement other context menu actions
        // Avoiding Orchestrated APIs as requested
      },

      handleUndo: () => {
        console.log('Undo action triggered');
        // TODO: Implement undo functionality using Worker API
      },

      handleRedo: () => {
        console.log('Redo action triggered');
        // TODO: Implement redo functionality using Worker API
      },

      handleCopy: () => {
        console.log('Copy action triggered for:', selectedIds);
        // TODO: Implement copy functionality using Worker API
      },

      handlePaste: () => {
        console.log('Paste action triggered');
        // TODO: Implement paste functionality using Worker API
      },

      handleDuplicate: () => {
        console.log('Duplicate action triggered for:', selectedIds);
        // TODO: Implement duplicate functionality using Worker API
      },

      handleImport: () => {
        console.log('Import action triggered');
        // TODO: Implement import functionality
      },

      handleExport: async () => {
        console.log('Export action triggered');
        await handleExport('json');
      },
    }),
    [client, treeId, pageNodeId, selectedIds, treeData, handleExport]
  );

  // Load tree data when client is ready
  useEffect(() => {
    if (!client || !pageNodeId) {
      console.log('[useTreeConsoleIntegration] Skipping load - client:', !!client, 'pageNodeId:', pageNodeId);
      return;
    }

    const loadTreeData = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        console.log('[useTreeConsoleIntegration] Loading tree data for node:', pageNodeId);

        // Get children of the current node using direct Worker API
        const children = await client.getChildren(pageNodeId as string);

        console.log('[useTreeConsoleIntegration] Loaded children:', children);

        // Convert TreeNode[] to TreeNodeData[]
        const treeNodeData = children.map(convertTreeNodeToTreeNodeData);
        setTreeData(treeNodeData);

        setState((prev) => ({ ...prev, loading: false }));
      } catch (err) {
        console.error('[useTreeConsoleIntegration] Failed to load tree data:', err);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    };

    loadTreeData();
  }, [client, pageNodeId]);

  // Permission checks (simplified for now, avoiding Orchestrated APIs)
  const canCreate = true;
  const canEdit = selectedIds.length === 1;
  const canDelete = selectedIds.length > 0;

  return {
    // Worker client (removed to avoid TS4094 error)
    loading: state.loading,
    error: state.error,

    // Tree data
    treeData,
    columns,
    breadcrumbItems,

    // UI state
    selectedIds,
    expandedIds,
    searchTerm,
    viewMode,

    // Permissions
    canCreate,
    canEdit,
    canDelete,

    // Actions
    actions,

    // Internal state
    state,
  };
}
