/**
  * DragDropOrchestrator
  * &
 * - /
 * -
 * -
  */
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { TreeViewController } from '../../../types/index.js';
export interface DragDropOrchestratorResult {
    draggingNodeId: NodeId | null;
    dropTargetNodeId: NodeId | null;
    isDragging: boolean;
    canDrop: (targetNodeId: NodeId) => boolean;
    startDrag: (nodeId: NodeId) => void;
    updateDropTarget: (targetNodeId: NodeId | null) => void;
    endDrag: () => void;
    handleDrop: (targetNodeId: NodeId) => Promise<void>;
}
/**
  * &
  */
export declare function useDragDropOrchestrator(controller: TreeViewController | null, tableData: TreeNode[]): DragDropOrchestratorResult;
//# sourceMappingURL=DragDropOrchestrator.d.ts.map