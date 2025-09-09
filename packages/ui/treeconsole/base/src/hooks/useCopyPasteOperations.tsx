import { useCallback, useMemo, useState } from 'react';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { WorkerAPIAdapter } from '~/adapters';

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

export interface UseCopyPasteOperationsOptions {
  /**
   * State manager ()
   */
  stateManager?: unknown;
  /** Worker API adapter */
  workerAdapter?: WorkerAPIAdapter;
  /** Loading state setter */
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
export function useCopyPasteOperations(
  options: UseCopyPasteOperationsOptions = {},
): UseCopyPasteOperationsReturn {
  const { stateManager, workerAdapter, setIsLoading } = options;

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

      //  WorkerAdapter: Placeholder implementation - copyNodes not yet implemented
      // TODO: Implement when WorkerAPIAdapter supports copyNodes method

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
    [workerAdapter, setIsLoading],
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

      //  WorkerAdapter: Placeholder implementation - cutNodes not yet implemented
      // TODO: Implement when WorkerAPIAdapter supports cutNodes method

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
    [workerAdapter, setIsLoading],
  );

  const pasteNodes = useCallback(
    async (targetParentId: NodeId): Promise<PasteResult> => {
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
                    name: `Node ${nodeId}`,
                    parentId: targetParentId,
                    nodeType: 'default',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    version: 1,
                  }) as TreeNode,
              ) || [],
          };
        } catch (error) {
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
            name: `Node ${nodeId} (${clipboardData.operation === 'copy' ? 'Copy' : 'Moved'})`,
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
    [clipboardData, stateManager, setIsLoading],
  );

  const canPaste = useMemo(() => {
    // TODO: Implement when WorkerAPIAdapter supports canPaste method
    return clipboardData !== null && clipboardData.nodes.length > 0;
  }, [clipboardData]);

  const canPasteToTarget = useCallback((targetId: NodeId): boolean => {
    // TODO: Implement when WorkerAPIAdapter supports canPaste method
    //  : true
    return targetId === 'folder-plugin-node';
  }, []);

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
