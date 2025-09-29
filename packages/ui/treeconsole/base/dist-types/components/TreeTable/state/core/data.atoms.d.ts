/**
  * Core Data Atoms
  * atom
 * -
 * -
 * -
  */
import type { TreeNode } from '@hierarchidb/common-type';
/**
    */
export declare const tableDataAtom: import("jotai").PrimitiveAtom<TreeNode[]> & {
    init: TreeNode[];
};
/**
    */
export declare const searchTermAtom: import("jotai").PrimitiveAtom<string> & {
    init: string;
};
/**
    */
export declare const filteredDataAtom: import("jotai").Atom<TreeNode[]>;
/**
    */
export declare const totalCountAtom: import("jotai").Atom<number>;
/**
    */
export declare const filteredCountAtom: import("jotai").Atom<number>;
/**
    */
export declare const isEmptyAtom: import("jotai").Atom<boolean>;
//# sourceMappingURL=data.atoms.d.ts.map