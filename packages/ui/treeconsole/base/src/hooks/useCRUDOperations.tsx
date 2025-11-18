import { useCallback } from 'react';
import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import type { WorkerAPIAdapter } from '../adapters/index.js';

type StateManagerLike = Partial<{
  moveNode: (nodeId: NodeId, targetParentId: NodeId, index: number) => Promise<void> | void;
  trashNode: (nodeId: NodeId) => Promise<void> | void;
  deleteNode: (nodeId: NodeId) => Promise<void> | void;
  duplicateNode: (nodeId: NodeId) => Promise<void> | void;
}>;

export interface UseCRUDOperationsOptions {
  stateManager?: StateManagerLike;
  /** Worker API adapter */
  workerAdapter?: WorkerAPIAdapter;
  /** Loading state setter */
  setIsLoading?: (loading: boolean) => void;
  /** Callback to update selected nodes */
  onSelectedNodesChange?: (updater: (prev: NodeId[]) => NodeId[]) => void;
  /** Callback to update expanded nodes */
  onExpandedNodesChange?: (updater: (prev: NodeId[]) => NodeId[]) => void;
  /** Callback to update current node */
  onCurrentNodeChange?: (updater: (prev: TreeNode | null) => TreeNode | null) => void;
}

export interface UseCRUDOperationsReturn {
  //  CRUD
  moveNode: (nodeId: NodeId, targetParentId: NodeId, index?: number) => Promise<void>;
  moveNodes: (nodeIds: NodeId[], targetParentId: NodeId) => Promise<void>;
  trashNode: (nodeId: NodeId) => Promise<void>;
  trashNodes: (nodeIds: NodeId[]) => Promise<void>;
  duplicateNode: (nodeId: NodeId) => Promise<void>;
  duplicateNodes: (nodeIds: NodeId[], targetParentId: NodeId) => Promise<void>;

  //  Working Copy
  startEdit: (nodeId: NodeId) => Promise<void>;
  startCreate: (parentId: NodeId, name: string) => Promise<void>;
}

export function useCRUDOperations(options: UseCRUDOperationsOptions = {}): UseCRUDOperationsReturn {
  const {
    stateManager,
    workerAdapter,
    setIsLoading,
    onSelectedNodesChange,
    onExpandedNodesChange,
    onCurrentNodeChange,
  } = options;

  //  CRUDWorkerAPIAdapter
  const moveNode = useCallback(
    async (nodeId: NodeId, targetParentId: NodeId, _index?: number) => {
      if (workerAdapter) {
        setIsLoading?.(true);
        try {
          await workerAdapter.moveNodes([nodeId], targetParentId);
          // Ensure parent is expanded to show moved node
          onExpandedNodesChange?.((prev) => {
            if (!prev.includes(targetParentId)) {
              return [...prev, targetParentId];
            }
            return prev;
          });
        } finally {
          setIsLoading?.(false);
        }
      } else {
        const canMove = stateManager && typeof stateManager.moveNode === 'function';
        if (!canMove) throw new Error('No adapter available for move operation');
        setIsLoading?.(true);
        try {
          const res: any = await stateManager.moveNode!(nodeId, targetParentId, _index ?? 0);
          if (res && typeof res === 'object' && 'success' in res && res.success === false) {
            if (res.error) console.error('Failed to move node:', res.error);
            return;
          }
          onExpandedNodesChange?.((prev) => (prev.includes(targetParentId) ? prev : [...prev, targetParentId]));
        } finally {
          setIsLoading?.(false);
        }
      }
    },
    [workerAdapter, stateManager, setIsLoading, onExpandedNodesChange],
  );

  const moveNodes = useCallback(
    async (nodeIds: NodeId[], targetParentId: NodeId) => {
      if (!workerAdapter) {
        throw new Error('WorkerAPIAdapter not available');
      }

      setIsLoading?.(true);
      try {
        await workerAdapter.moveNodes(nodeIds, targetParentId);
        // Ensure parent is expanded to show moved nodes
        onExpandedNodesChange?.((prev) => {
          if (!prev.includes(targetParentId)) {
            return [...prev, targetParentId];
          }
          return prev;
        });
      } finally {
        setIsLoading?.(false);
      }
    },
    [workerAdapter, setIsLoading, onExpandedNodesChange],
  );

  const trashNode = useCallback(
    async (nodeId: NodeId) => {
      if (workerAdapter) {
        setIsLoading?.(true);
        try {
          await workerAdapter.trashNodes([nodeId]);
          // Remove from selection
          onSelectedNodesChange?.((prev) => prev.filter((id) => id !== nodeId));
          // Remove from expanded nodes
          onExpandedNodesChange?.((prev) => prev.filter((id) => id !== nodeId));
          // Clear current node if it was trashed
          onCurrentNodeChange?.((prev) => (prev?.id === nodeId ? null : prev));
        } finally {
          setIsLoading?.(false);
        }
      } else {
        const deleteFn = stateManager?.deleteNode ?? stateManager?.trashNode;
        if (typeof deleteFn !== 'function') throw new Error('No adapter available for trash operation');
        setIsLoading?.(true);
        try {
          await deleteFn(nodeId);
          onSelectedNodesChange?.((prev) => prev.filter((id) => id !== nodeId));
          onExpandedNodesChange?.((prev) => prev.filter((id) => id !== nodeId));
          onCurrentNodeChange?.((prev) => (prev?.id === nodeId ? null : prev));
        } finally {
          setIsLoading?.(false);
        }
      }
    },
    [workerAdapter, stateManager, setIsLoading, onSelectedNodesChange, onExpandedNodesChange, onCurrentNodeChange],
  );

  const trashNodes = useCallback(
    async (nodeIds: NodeId[]) => {
      if (!workerAdapter) {
        const deleteFn = stateManager?.deleteNode ?? stateManager?.trashNode;
        if (typeof deleteFn !== 'function') throw new Error('WorkerAPIAdapter not available');
        setIsLoading?.(true);
        try {
          for (const id of nodeIds) await deleteFn(id);
          onSelectedNodesChange?.((prev) => prev.filter((id) => !nodeIds.includes(id)));
          onExpandedNodesChange?.((prev) => prev.filter((id) => !nodeIds.includes(id)));
          onCurrentNodeChange?.((prev) => (prev && nodeIds.includes(prev.id) ? null : prev));
        } finally {
          setIsLoading?.(false);
        }
        return;
      }

      setIsLoading?.(true);
      try {
        await workerAdapter.trashNodes(nodeIds);
        // Remove from selection
        onSelectedNodesChange?.((prev) => prev.filter((id) => !nodeIds.includes(id)));
        // Remove from expanded nodes
        onExpandedNodesChange?.((prev) => prev.filter((id) => !nodeIds.includes(id)));
        // Clear current node if it was trashed
        onCurrentNodeChange?.((prev) => (prev && nodeIds.includes(prev.id) ? null : prev));
      } finally {
        setIsLoading?.(false);
      }
    },
    [workerAdapter, stateManager, setIsLoading, onSelectedNodesChange, onExpandedNodesChange, onCurrentNodeChange],
  );

  const duplicateNode = useCallback(
    async (nodeId: NodeId) => {
      if (!workerAdapter) {
        const canDup = stateManager && typeof stateManager.duplicateNode === 'function';
        if (!canDup) throw new Error('WorkerAPIAdapter not available');
        setIsLoading?.(true);
        try {
          const result: any = await stateManager.duplicateNode!(nodeId);
          const duplicated: Partial<TreeNode> | undefined = result?.data;

          // Update selection to include original and duplicated node
          if (duplicated?.id) {
            onSelectedNodesChange?.(() => [nodeId, duplicated.id as NodeId]);
          } else {
            onSelectedNodesChange?.((prev) => (prev.includes(nodeId) ? prev : [...prev, nodeId]));
          }

          // Expand parentId of duplicated node if available
          if (duplicated?.parentId) {
            onExpandedNodesChange?.((prev) => (prev.includes(duplicated.parentId as NodeId) ? prev : [...prev, duplicated.parentId as NodeId]));
          }

          // Set current node to duplicated node when available
          if (duplicated) {
            onCurrentNodeChange?.(() => duplicated as TreeNode);
          }
        } finally {
          setIsLoading?.(false);
        }
        return;
      }

      setIsLoading?.(true);
      try {
        await workerAdapter.duplicateNodes([nodeId], nodeId);
      } finally {
        setIsLoading?.(false);
      }
    },
    [workerAdapter, setIsLoading, stateManager, onSelectedNodesChange, onExpandedNodesChange, onCurrentNodeChange],
  );

  const duplicateNodes = useCallback(
    async (nodeIds: NodeId[], targetParentId: NodeId) => {
      if (!workerAdapter) {
        throw new Error('WorkerAPIAdapter not available');
      }

      setIsLoading?.(true);
      try {
        await workerAdapter.duplicateNodes(nodeIds, targetParentId);
        // Expand parent to show duplicated nodes
        onExpandedNodesChange?.((prev) => {
          if (!prev.includes(targetParentId)) {
            return [...prev, targetParentId];
          }
          return prev;
        });
      } finally {
        setIsLoading?.(false);
      }
    },
    [workerAdapter, setIsLoading, onExpandedNodesChange],
  );

  //  Working Copy
  const startEdit = useCallback(
    async (nodeId: NodeId) => {
      if (!workerAdapter) {
        throw new Error('WorkerAPIAdapter not available');
      }

      const editSession = await workerAdapter.startNodeEdit(nodeId);
      console.log('Edit session started:', editSession);
    },
    [workerAdapter],
  );

  const startCreate = useCallback(
    async (parentId: NodeId, name: string) => {
      if (!workerAdapter) {
        throw new Error('WorkerAPIAdapter not available');
      }

      const createSession = await workerAdapter.startNodeCreate(parentId, name, undefined);
      console.log('Create session started:', createSession);
    },
    [workerAdapter],
  );

  return {
    //  CRUD
    moveNode,
    moveNodes,
    trashNode,
    trashNodes,
    duplicateNode,
    duplicateNodes,

    //  Working Copy
    startEdit,
    startCreate,
  };
}
