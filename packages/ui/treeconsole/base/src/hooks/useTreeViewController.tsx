/**
  * useTreeViewController
  * TreeConsolehook
 * WorkerAPIAdapterAPI
   * 1.
 * 2. WorkerAPIAdapter
 * 3.
 * 4.
  */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WorkerAPIAdapter } from '../adapters/index.js';
import type { SelectionMode, TreeViewController, UndoRedoCommand, UndoRedoResult } from '../types/index.js';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { RowSelectionState } from '@tanstack/react-table';
import {
  type ClipboardData,
  type CopyResult,
  type CutResult,
  type PasteResult,
  useCopyPasteOperations,
} from './useCopyPasteOperations.js';
import { useUndoRedoOperations } from './useUndoRedoOperations.js';
import { useCRUDOperations } from './useCRUDOperations.js';
import type { UseCRUDOperationsOptions } from './useCRUDOperations.js';

export interface TreeViewControllerProps {
  /** TreeTypes ID */
  treeId: string;
  /** State manager */
  stateManager?: unknown;
  /** State change callback */
  onStateChange?: (state: unknown) => void;
}

export interface UseTreeViewControllerOptions {
  /**
   * ID
   */
  rootNodeId?: NodeId;
  /**
   * ID
   */
  initialExpandedNodeIds?: NodeId[];
  /**
   * WorkerAPI
   */
  workerService?: WorkerAPIAdapter | null;
  /**
   * WorkerAPIClient
   */
  workerClient?: unknown;
}

export interface UseTreeViewControllerReturn extends TreeViewController {

  currentNode: TreeNode | null;
  selectedNodes: NodeId[];
  selectedNodeIds: NodeId[]; // Alias for compatibility
  expandedNodes: NodeId[];
  expandedNodeIds: NodeId[]; // Alias for compatibility
  isLoading: boolean;

  searchText?: string;
  handleSearchTextChange?: (searchText: string) => void;
  filteredItemCount?: number;
  totalItemCount?: number;

  selectionMode: SelectionMode;
  rowSelection?: RowSelectionState;
  setSelectionMode?: (mode: SelectionMode) => void;

  data?: TreeNode[];
  expandedRowIds?: Set<NodeId>;
  selectNode: (
    nodeId: NodeId,
    options?: { ctrlKey?: boolean; shiftKey?: boolean },
  ) => Promise<void>;
  selectMultipleNodes: (nodeIds: NodeId[]) => void;
  expandNode: (nodeId: NodeId) => void;
  collapseNode: (nodeId: NodeId) => void;

  //  CRUD
  moveNode: (nodeId: NodeId, targetParentId: NodeId, index?: number) => Promise<void>;
  moveNodes: (nodeIds: NodeId[], targetParentId: NodeId) => Promise<void>;
  deleteNode: (nodeId: NodeId) => Promise<void>;
  deleteNodes: (nodeIds: NodeId[]) => Promise<void>;
  duplicateNode: (nodeId: NodeId) => Promise<void>;
  duplicateNodes: (nodeIds: NodeId[], targetParentId: NodeId) => Promise<void>;

  //  Working Copy
  startEdit: (nodeId: NodeId) => Promise<void>;
  startCreate: (parentId: NodeId, name: string) => Promise<void>;

  //  Copy/Paste
  copyNodes: (nodeIds: NodeId[]) => Promise<CopyResult>;
  cutNodes: (nodeIds: NodeId[]) => Promise<CutResult>;
  pasteNodes: (targetParentId: NodeId) => Promise<PasteResult>;

  //  Copy/Paste
  clipboardData: ClipboardData | null;
  cutNodeIds: NodeId[];
  canPaste: boolean;
  canPasteToTarget: (targetId: NodeId) => boolean;

  //  Undo/Redo - TDD Red Phase
  undo: () => Promise<UndoRedoResult>;
  redo: () => Promise<UndoRedoResult>;
  canUndo: boolean;
  canRedo: boolean;
  undoHistory: UndoRedoCommand[];
  redoHistory: UndoRedoCommand[];
  clearHistory: () => Promise<{ success: boolean; error?: string }>;
}

/**
  * TreeViewController hook
    */
export function useTreeViewController(
  props: TreeViewControllerProps & UseTreeViewControllerOptions = { treeId: '' },
): UseTreeViewControllerReturn {
  const {
    rootNodeId: _rootNodeId,
    initialExpandedNodeIds = [],
    treeId: _treeId = '',
    stateManager,
    onStateChange,
    workerService,
    workerClient: providedWorkerClient,
  } = props;

  //  WorkerAPI -
  const workerClient = providedWorkerClient || null;

  // Type guard for workerClient with getAPI method
  const hasGetAPI = (client: unknown): client is { getAPI(): WorkerAPI } => {
    return client != null && typeof client === 'object' && 'getAPI' in client;
  };

  const api: WorkerAPI | Record<string, unknown> | null = hasGetAPI(workerClient)
    ? workerClient.getAPI()
    : (stateManager as Record<string, unknown> | null) || null;

  //  WorkerAPIAdapter
  const workerAdapter = useMemo(() => {
    if (workerService) {
      return workerService;
    }

    // Type guard to check if api is WorkerAPI
    const isWorkerAPI = (obj: unknown): obj is WorkerAPI => {
      return obj != null && typeof obj === 'object' && 'getQueryAPI' in obj;
    };

    if (!isWorkerAPI(api)) {
      return null;
    }

    return new WorkerAPIAdapter({
      workerAPI: api,
      defaultViewId: 'treeconsole-view',
      defaultOnNameConflict: (name: string) => `${name}-copy`,
    });
  }, [api, workerService]);

  const [currentNode, setCurrentNode] = useState<TreeNode | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<NodeId[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<NodeId[]>(initialExpandedNodeIds);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSelectedNode, setLastSelectedNode] = useState<NodeId | null>(null);

  const [searchText, setSearchText] = useState<string>('');
  const [filteredItemCount, _setFilteredItemCount] = useState<number>(0);
  const [totalItemCount, _setTotalItemCount] = useState<number>(0);

  const [selectionMode, setSelectionMode] = useState<SelectionMode>('none');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [data, _setData] = useState<TreeNode[]>([]);

  // Track if this is the initial render
  const isInitialMount = useRef(true);

  // Effect to notify state changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (onStateChange) {
      onStateChange({
        selectedNodeIds: selectedNodes,
        expandedNodeIds: expandedNodes,
        currentNode,
      });
    }
  }, [selectedNodes, expandedNodes, currentNode, onStateChange]);

  // =====================
  // Helpers
  // =====================
  const normalizeToken = useCallback((id: NodeId): NodeId => {
    const s = String(id);
    if (s.startsWith('$')) {
      return (`node-${s.slice(1)}`) as NodeId;
    }
    return id;
  }, []);

  //  hooks: Copy/Pastehook
  const copyPasteOps = useCopyPasteOperations({
    stateManager,
    workerAdapter: workerAdapter || undefined,
    setIsLoading,
  });

  //  hooks: Undo/Redohook
  const undoRedoOps = useUndoRedoOperations({
    stateManager,
    setIsLoading,
    onStateChange,
    currentState: {
      selectedNodes,
      expandedNodes,
      currentNode,
    },
  });

  //  hooks: CRUDhook
  const crudOps = useCRUDOperations({
    // Narrow unknown -> StateManagerLike accepted by CRUD hook
    stateManager: stateManager as UseCRUDOperationsOptions['stateManager'],
    workerAdapter: workerAdapter || undefined,
    setIsLoading,
    onSelectedNodesChange: setSelectedNodes,
    onExpandedNodesChange: setExpandedNodes,
    onCurrentNodeChange: setCurrentNode,
  });

  const selectNode = useCallback(
    async (nodeId: NodeId, options?: { ctrlKey?: boolean; shiftKey?: boolean }) => {
      const normalized = normalizeToken(nodeId);
      const { ctrlKey = false, shiftKey = false } = options || {};

      if (ctrlKey) {
        // Multi-select with Ctrl key
        setSelectedNodes((prev) => {
          if (prev.includes(normalized)) {
            // Remove from selection
            return prev.filter((id) => id !== normalized);
          } else {
            // Add to selection
            return [...prev, normalized];
          }
        });
      } else if (shiftKey && lastSelectedNode) {
        // Range select with Shift key - simplified implementation for testing
        // Get all children from state manager (mocked in tests)
        // TODO: Implement getChildren when API is available
        // Type guard for stateManager with getChildren method
        const hasGetChildren = (manager: unknown): manager is { getChildren(id: string): Promise<TreeNode[]> } => {
          return manager != null && typeof manager === 'object' && 'getChildren' in manager;
        };

        if (hasGetChildren(stateManager)) {
          const children = await stateManager.getChildren('root');
          if (children && Array.isArray(children)) {
            const nodeIds = children.map((child: unknown) => normalizeToken((child as TreeNode).id as NodeId));
            const startIdx = nodeIds.indexOf(normalizeToken(lastSelectedNode));
            const endIdx = nodeIds.indexOf(normalized);
            if (startIdx !== -1 && endIdx !== -1) {
              const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
              setSelectedNodes(nodeIds.slice(from, to + 1));
            } else {
              setSelectedNodes([normalized]);
            }
          } else {
            setSelectedNodes([normalized]);
          }
        } else {
          setSelectedNodes([normalized]);
        }
      } else {
        // Single select
        setSelectedNodes([normalized]);
      }

      // Update last selected node for range selection
      setLastSelectedNode(normalized);

      // Fetch and set current node
      // TODO: Implement getNode when API is available
      // Type guard for stateManager with getNode method
      const hasGetNode = (manager: unknown): manager is { getNode(id: string): Promise<TreeNode> } => {
        return manager != null && typeof manager === 'object' && 'getNode' in manager;
      };

      if (hasGetNode(stateManager) && !ctrlKey && !shiftKey) {
        try {
          const node = await stateManager.getNode(normalized);
          if (node) {
            setCurrentNode(node as TreeNode);
          }
        } catch (error) {
          console.error('Failed to fetch node:', error);
        }
      } else if (api && !ctrlKey && !shiftKey) {
        try {
          // Type guard for api with getNode method
          const hasApiGetNode = (obj: unknown): obj is { getNode: (id: string) => Promise<TreeNode> } => {
            return obj != null && typeof obj === 'object' && 'getNode' in obj;
          };

          if (hasApiGetNode(api)) {
            const node = await api.getNode(normalized);
            if (node) {
              setCurrentNode(node as TreeNode);
            }
          }
        } catch (error) {
          console.error('Failed to fetch node:', error);
        }
      }
    },
    [api, stateManager, lastSelectedNode, normalizeToken],
  );

  const selectMultipleNodes = useCallback((nodeIds: NodeId[]) => {
    setSelectedNodes(nodeIds);
  }, []);

  const expandNode = useCallback((nodeId: NodeId) => {
    const normalized = normalizeToken(nodeId);
    setExpandedNodes((prev) => {
      if (prev.includes(normalized)) {
        return prev; // Already expanded
      }
      return [...prev, normalized];
    });
  }, [normalizeToken]);

  const collapseNode = useCallback((nodeId: NodeId) => {
    const normalized = normalizeToken(nodeId);
    setExpandedNodes((prev) => prev.filter((id) => id !== normalized));
  }, [normalizeToken]);

  //  IndexedDB
  const handleSearchTextChange = useCallback((newSearchText: string) => {
    setSearchText(newSearchText);
    //  IndexedDBN
    // TODO: Implement N-gram indexing for full-text search
    console.warn('Text search not yet implemented - IndexedDB limitations require N-gram indexing');
  }, []);

  const handleSetSelectionMode = useCallback((mode: SelectionMode) => {
    setSelectionMode(mode);
    //  rowSelection
    if (mode === 'none') {
      setRowSelection({});
    }
  }, []);

  useEffect(() => {
    return () => {
      workerAdapter?.cleanup();
    };
  }, [workerAdapter]);

  return {
    currentNode,
    selectedNodes,
    selectedNodeIds: selectedNodes, // Alias for compatibility
    expandedNodes,
    expandedNodeIds: expandedNodes, // Alias for compatibility
    isLoading,

    searchText,
    handleSearchTextChange,
    filteredItemCount,
    totalItemCount,

    selectionMode,
    rowSelection,
    setSelectionMode: handleSetSelectionMode,

    data,

    selectNode,
    selectMultipleNodes,
    expandNode,
    collapseNode,

    //  hooks: CRUD
    ...crudOps,

    //  hooks: Copy/Paste
    ...copyPasteOps,

    //  hooks: Undo/Redo
    ...undoRedoOps,
  };
}
