/**
  * Subscription Feature Atoms
  * SubTreeatom
 * -
 * -
  */
export interface SubTreeChanges {
    added?: Array<{
        id: string;
        parentId?: string | null;
        [k: string]: unknown;
    }>;
    updated?: Array<{
        nodeId: string;
        changes: Record<string, unknown>;
    }>;
    removed?: string[];
    moved?: Array<{
        nodeId: string;
        oldParentId?: string;
        newParentId: string;
        oldIndex?: number;
        newIndex?: number;
    }>;
}
/**
  * SubTreeID
  */
export declare const subscribedRootNodeIdAtom: import("jotai").PrimitiveAtom<string | null> & {
    init: string | null;
};
/**
  * ID
  */
export declare const subscriptionIdAtom: import("jotai").PrimitiveAtom<string | null> & {
    init: string | null;
};
/**
    */
export declare const subscriptionDepthAtom: import("jotai").PrimitiveAtom<number> & {
    init: number;
};
/**
    */
export declare const lastUpdateTimestampAtom: import("jotai").PrimitiveAtom<number> & {
    init: number;
};
/**
    */
export declare const pendingUpdatesAtom: import("jotai").PrimitiveAtom<SubTreeChanges[]> & {
    init: SubTreeChanges[];
};
//# sourceMappingURL=subscription.atoms.d.ts.map