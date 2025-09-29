/**
  * Drag & Drop Feature Atoms
  * &atom
 * -
 * -
 * -
  */
import type { NodeId } from '@hierarchidb/common-type';
/**
  * ID
  */
export declare const draggingNodeIdAtom: import("jotai").PrimitiveAtom<NodeId | null> & {
    init: NodeId | null;
};
/**
  * ID
  */
export declare const dropTargetNodeIdAtom: import("jotai").PrimitiveAtom<NodeId | null> & {
    init: NodeId | null;
};
/**
    */
export declare const forbiddenDropTargetsAtom: import("jotai").PrimitiveAtom<Set<NodeId>> & {
    init: Set<NodeId>;
};
//# sourceMappingURL=dragDrop.atoms.d.ts.map