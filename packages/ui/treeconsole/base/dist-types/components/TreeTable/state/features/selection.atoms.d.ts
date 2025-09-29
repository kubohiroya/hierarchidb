/**
  * Selection Feature Atoms
  * atom
 * -
 * -
 * -
  */
import type { RowSelectionState } from '@tanstack/react-table';
/**
    */
export declare const rowSelectionAtom: import("jotai").PrimitiveAtom<RowSelectionState> & {
    init: RowSelectionState;
};
/**
    */
export type SelectionMode = 'none' | 'single' | 'multiple';
export declare const selectionModeAtom: import("jotai").PrimitiveAtom<SelectionMode> & {
    init: SelectionMode;
};
/**
    */
export type RowClickAction = 'select-navigate' | 'select' | 'edit';
export declare const rowClickActionAtom: import("jotai").PrimitiveAtom<RowClickAction> & {
    init: RowClickAction;
};
/**
  * ID
  */
export declare const selectedNodeIdsAtom: import("jotai").Atom<string[]>;
/**
    */
export declare const selectedCountAtom: import("jotai").Atom<number>;
/**
    */
export declare const clearSelectionAtom: import("jotai").WritableAtom<null, [], void> & {
    init: null;
};
/**
    */
export declare const selectAllAtom: import("jotai").WritableAtom<null, [], void> & {
    init: null;
};
//# sourceMappingURL=selection.atoms.d.ts.map