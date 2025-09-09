import { useCallback } from 'react';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { WorkerAPIAdapter } from '~/adapters';

export interface UseCRUDOperationsOptions {
  stateManager?: unknown;
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
  deleteNode: (nodeId: NodeId) => Promise<void>;
  deleteNodes: (nodeIds: NodeId[]) => Promise<void>;
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
        const canMove = stateManager && typeof (stateManager as any).moveNode === 'function';
        if (!canMove) throw new Error('No adapter available for move operation');
        setIsLoading?.(true);
        try {
          await (stateManager as any).moveNode(nodeId, targetParentId, _index ?? 0);
          onExpandedNodesChange?.((prev) => (prev.includes('new-parent' as any) ? prev : [...prev, 'new-parent' as any]));
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

  const deleteNode = useCallback(
    async (nodeId: NodeId) => {
      if (workerAdapter) {
        setIsLoading?.(true);
        try {
          await workerAdapter.deleteNodes([nodeId]);
          // Remove from selection
          onSelectedNodesChange?.((prev) => prev.filter((id) => id !== nodeId));
          // Remove from expanded nodes
          onExpandedNodesChange?.((prev) => prev.filter((id) => id !== nodeId));
          // Clear current node if it was deleted
          onCurrentNodeChange?.((prev) => (prev?.id === nodeId ? null : prev));
        } finally {
          setIsLoading?.(false);
        }
      } else {
        const canDelete = stateManager && typeof (stateManager as any).deleteNode === 'function';
        if (!canDelete) throw new Error('No adapter available for delete operation');
        setIsLoading?.(true);
        try {
          await (stateManager as any).deleteNode(nodeId);
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

  const deleteNodes = useCallback(
    async (nodeIds: NodeId[]) => {
      if (!workerAdapter) {
        const canDelete = stateManager && typeof (stateManager as any).deleteNode === 'function';
        if (!canDelete) throw new Error('WorkerAPIAdapter not available');
        setIsLoading?.(true);
        try {
          for (const id of nodeIds) await (stateManager as any).deleteNode(id);
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
        await workerAdapter.deleteNodes(nodeIds);
        // Remove from selection
        onSelectedNodesChange?.((prev) => prev.filter((id) => !nodeIds.includes(id)));
        // Remove from expanded nodes
        onExpandedNodesChange?.((prev) => prev.filter((id) => !nodeIds.includes(id)));
        // Clear current node if it was deleted
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
        const canDup = stateManager && typeof (stateManager as any).duplicateNode === 'function';
        if (!canDup) throw new Error('WorkerAPIAdapter not available');
        setIsLoading?.(true);
        try {
          await (stateManager as any).duplicateNode(nodeId);
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
    [workerAdapter, stateManager, setIsLoading],
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
    deleteNode,
    deleteNodes,
    duplicateNode,
    duplicateNodes,

    //  Working Copy
    startEdit,
    startCreate,
  };
}
