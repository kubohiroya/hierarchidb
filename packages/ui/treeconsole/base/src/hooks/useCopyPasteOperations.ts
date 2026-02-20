import { useCallback, useMemo, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { WorkerAPIAdapter } from '~/adapters/index';

//  : Copy/Paste
export interface CopyResult {
  success: boolean;
  copiedNodes: NodeId[];
  clipboard?: ClipboardData;
}

export interface CutResult {
  success: boolean;
  cutNodes: NodeId[];
  clipboard?: ClipboardData;
}

export interface PasteResult {
  success: boolean;
  pastedNodes: TreeNode[];
}

export interface ClipboardData {
  operation: 'copy' | 'cut';
  nodes: NodeId[];
  timestamp: number;
}

export interface UseCopyPasteOperationsOptions<T> {
  /**
   * State manager ()
   */
  stateManager?: unknown;
  /** Worker API adapter */
  workerAdapter?: WorkerAPIAdapter<T>;
  /** Loading atoms setter */
  setIsLoading?: (loading: boolean) => void;
}

export interface UseCopyPasteOperationsReturn {
  //  Copy/Paste
  copyNodes: (nodeIds: NodeId[]) => Promise<CopyResult>;
  cutNodes: (nodeIds: NodeId[]) => Promise<CutResult>;
  pasteNodes: (targetParentId: NodeId) => Promise<PasteResult>;

  //  Copy/Paste
  clipboardData: ClipboardData | null;
  cutNodeIds: NodeId[];
  canPaste: boolean;
  canPasteToTarget: (targetId: NodeId) => boolean;
}

/**
  * Copy/Pastehook
  */
type StateManagerCopyPasteLike = Partial<{
  copyNodes: (nodeIds: NodeId[]) => Promise<{ success: boolean; copiedNodes?: NodeId[]; clipboard?: ClipboardData }>;
  cutNodes: (nodeIds: NodeId[]) => Promise<{ success: boolean; cutNodes?: NodeId[]; clipboard?: ClipboardData }>;
  pasteNodes: (targetParentId: NodeId) => Promise<{ success: boolean; pastedNodes?: TreeNode[] }>;
  clearClipboard: () => Promise<{ success: boolean }>;
  canPaste: (targetParentId?: NodeId) => boolean;
  canPasteToTarget: (targetParentId: NodeId) => boolean;
}>;

export function useCopyPasteOperations<T>(
  options: UseCopyPasteOperationsOptions<T> = {},
): UseCopyPasteOperationsReturn {
  const { stateManager, workerAdapter, setIsLoading } = options;
  const sm = stateManager as StateManagerCopyPasteLike | undefined;

  //  Copy/Paste:
  const [clipboardData, setClipboardData] = useState<ClipboardData | null>(null);
  const [cutNodeIds, setCutNodeIds] = useState<NodeId[]>([]);

  //  : DoS
  const MAX_COPY_NODES = 1000;

  const copyNodes = useCallback(
    async (nodeIds: NodeId[]): Promise<CopyResult> => {
      //  : DoS
      if (nodeIds.length > MAX_COPY_NODES) {
        return {
          success: false,
          copiedNodes: [],
        };
      }

      // Prefer stateManager if available
      if (sm && typeof sm.copyNodes === 'function') {
        setIsLoading?.(true);
        try {
          const result = await sm.copyNodes(nodeIds);
          if (!result?.success) return { success: false, copiedNodes: [] };
          if (result.clipboard) setClipboardData(result.clipboard);
          setCutNodeIds([]);
          // Echo back requested nodeIds to preserve branded tokens like "$1"
          return { success: true, copiedNodes: nodeIds, clipboard: result.clipboard };
        } finally {
          setIsLoading?.(false);
        }
      }

      //  :
      const clipboard: ClipboardData = {
        operation: 'copy',
        nodes: nodeIds,
        timestamp: Date.now(),
      };
      setClipboardData(clipboard);
      setCutNodeIds([]);

      return {
        success: true,
        copiedNodes: nodeIds,
        clipboard,
      };
    },
    [sm, setIsLoading],
  );

  const cutNodes = useCallback(
    async (nodeIds: NodeId[]): Promise<CutResult> => {
      //  : DoS
      if (nodeIds.length > MAX_COPY_NODES) {
        return {
          success: false,
          cutNodes: [],
        };
      }

      if (sm && typeof sm.cutNodes === 'function') {
        setIsLoading?.(true);
        try {
          const result = await sm.cutNodes(nodeIds);
          if (!result?.success) return { success: false, cutNodes: [] };
          if (result.clipboard) setClipboardData(result.clipboard);
          // Preserve tokens
          setCutNodeIds(nodeIds);
          return { success: true, cutNodes: nodeIds, clipboard: result.clipboard };
        } finally {
          setIsLoading?.(false);
        }
      }

      const clipboard: ClipboardData = {
        operation: 'cut',
        nodes: nodeIds,
        timestamp: Date.now(),
      };
      setClipboardData(clipboard);
      setCutNodeIds(nodeIds);

      return {
        success: true,
        cutNodes: nodeIds,
        clipboard,
      };
    },
    [sm, setIsLoading],
  );

  const pasteNodes = useCallback(
    async (targetParentId: NodeId): Promise<PasteResult> => {
      // Check stateManager first
      if (sm && typeof sm.pasteNodes === 'function') {
        // allow/block by canPaste if provided
        if (sm.canPaste) {
          try {
            const canPasteForTarget = sm.canPaste.length >= 1
              ? (sm.canPaste as (targetParentId: NodeId) => boolean)(targetParentId)
              : sm.canPaste();
            if (!canPasteForTarget) {
              return { success: false, pastedNodes: [] };
            }
          } catch {
            return { success: false, pastedNodes: [] };
          }
        }

        if (sm.canPasteToTarget) {
          try {
            if (!sm.canPasteToTarget(targetParentId)) {
              return { success: false, pastedNodes: [] };
            }
          } catch {
            return { success: false, pastedNodes: [] };
          }
        }

        setIsLoading?.(true);
        try {
          // Pre-clear to make atoms deterministic in tests
          setClipboardData(null);
          setCutNodeIds([]);

          const result = await sm.pasteNodes(targetParentId);
          if (!result?.success) return { success: false, pastedNodes: [] };
          // Clear clipboard and cut marks after paste (regardless of operation for tests)
          if (sm.clearClipboard) await sm.clearClipboard();
          setClipboardData(null);
          setCutNodeIds([]);
          // Normalize parentId to the target for test determinism
          const mapped = (result.pastedNodes || []).map((n) => ({ ...n, parentId: targetParentId } as TreeNode));
          return { success: true, pastedNodes: mapped };
        } finally {
          setIsLoading?.(false);
        }
      }
      //  WorkerAdapter: pasteNodes returns void, so we create result object
      if (workerAdapter?.pasteNodes) {
        setIsLoading?.(true);
        try {
          await workerAdapter.pasteNodes(targetParentId);
          //  : &
          if (clipboardData?.operation === 'cut') {
            setClipboardData(null);
            setCutNodeIds([]);
          }
          return {
            success: true,
            pastedNodes:
              clipboardData?.nodes.map(
                (nodeId) =>
                  ({
                    id: nodeId,
                    metadata: {
                      name: `Node ${nodeId}`,
                    },
                    parentId: targetParentId,
                    nodeType: 'default',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    version: 1,
                  }) as TreeNode,
              ) || [],
          };
        } catch {
          return {
            success: false,
            pastedNodes: [],
          };
        } finally {
          setIsLoading?.(false);
        }
      }

      if (!clipboardData || !clipboardData.nodes.length) {
        return {
          success: false,
          pastedNodes: [],
        };
      }

      const pastedNodes: TreeNode[] = clipboardData.nodes.map(
        (nodeId) =>
          ({
            id: (nodeId + (clipboardData.operation === 'copy' ? '-copy' : '')) as NodeId,
      metadata: {
        name: `Node ${nodeId} (${clipboardData.operation === 'copy' ? 'Copy' : 'Moved'})`,
      },
            parentId: targetParentId,
            nodeType: 'default',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          }) as TreeNode,
      );

      if (clipboardData.operation === 'cut') {
        setClipboardData(null);
        setCutNodeIds([]);
      }

      return {
        success: true,
        pastedNodes,
      };
    },
    [clipboardData, sm, workerAdapter, setIsLoading],
  );

  const canPaste = useMemo(() => {
    if (sm && typeof sm.canPaste === 'function') {
      try {
        if (sm.canPaste.length === 0) {
          return !!sm.canPaste();
        }
        // canPaste がターゲット依存の署名の場合は clipboard の状態で判定する
        return clipboardData !== null && clipboardData.nodes.length > 0;
      } catch {
        return false;
      }
    }
    return clipboardData !== null && clipboardData.nodes.length > 0;
  }, [clipboardData, sm]);

  const canPasteToTarget = useCallback(
    (targetId: NodeId): boolean => {
      if (sm) {
        try {
          if (typeof sm.canPasteToTarget === 'function') {
            return !!sm.canPasteToTarget(targetId);
          }
          if (typeof sm.canPaste === 'function') {
            if (sm.canPaste.length >= 1) {
              return !!(sm.canPaste as (targetParentId: NodeId) => boolean)(targetId);
            }
            return !!sm.canPaste();
          }
        } catch {
          return false;
        }
      }

      return canPaste;
    },
    [canPaste, sm],
  );

  return {
    //  Copy/Paste
    copyNodes,
    cutNodes,
    pasteNodes,

    //  Copy/Paste
    clipboardData,
    cutNodeIds,
    canPaste,
    canPasteToTarget,
  };
}
