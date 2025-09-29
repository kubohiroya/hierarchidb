/**
  * Expansion Feature Atoms
  * /atom
 * -
 * -
  */
import type { ExpandedState } from '@tanstack/react-table';
/**
    */
export declare const expandedAtom: import("jotai").PrimitiveAtom<ExpandedState> & {
    init: ExpandedState;
};
/**
    */
export declare const toggleExpandedAtom: import("jotai").WritableAtom<null, [nodeId: string], void> & {
    init: null;
};
/**
  * /
  */
export declare const toggleAllExpandedAtom: import("jotai").WritableAtom<null, [], void> & {
    init: null;
};
//# sourceMappingURL=expansion.atoms.d.ts.map