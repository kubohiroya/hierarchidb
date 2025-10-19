import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import type { WorkingCopyBase, WorkingCopyDraft } from '@hierarchidb/plugin-ui-sdk';
export interface CreateDraftWorkingCopyParams<TEntity> {
    draft: Partial<TEntity>;
    meta: {
        treeNodeId: NodeId;
        createdAt?: Timestamp;
        updatedAt?: Timestamp;
        originalVersion?: number;
    };
}
export declare function createDraftWorkingCopyBase<TEntity>(params: CreateDraftWorkingCopyParams<TEntity>): WorkingCopyBase<TEntity>;
export declare function markWorkingCopyUpdated<TEntity>(workingCopy: WorkingCopyDraft<TEntity>, updates: Partial<TEntity>, timestamp?: Timestamp): WorkingCopyDraft<TEntity>;
//# sourceMappingURL=workingCopy.d.ts.map
