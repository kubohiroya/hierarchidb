import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import type { WorkingCopyDraft } from './types.js';
export interface EntityWorkingCopyAdapter<TEntity, TWorkingCopy extends WorkingCopyDraft<TEntity>> {
    fromEntity(entity: TEntity): TWorkingCopy;
    createDraft(treeNodeId: NodeId, overrides?: Partial<TEntity>): TWorkingCopy;
    merge(workingCopy: TWorkingCopy, updates: Partial<TEntity>, timestamp?: Timestamp): TWorkingCopy;
}
export interface EntityAdapterOptions<TEntity, TWorkingCopy extends WorkingCopyDraft<TEntity>> {
    /**
     * Produce a partial snapshot (draft payload) from the entity.
     * Must include domain fields that should remain mutable in the working copy.
     */
    draftFromEntity(entity: TEntity): Partial<TEntity>;
    /**
     * Produce a draft payload for new working copies (create flow).
     */
    draftDefaults(treeNodeId: NodeId, overrides?: Partial<TEntity>): Partial<TEntity>;
    /**
     * Optional hook when creating a working copy from entity.
     */
    finalize?(workingCopy: TWorkingCopy, source: TEntity): TWorkingCopy;
    /**
     * Optional hook when creating a draft working copy.
     */
    finalizeDraft?(workingCopy: TWorkingCopy, treeNodeId: NodeId): TWorkingCopy;
}
export declare function createEntityWorkingCopyAdapter<TEntity, TWorkingCopy extends WorkingCopyDraft<TEntity>>(options: EntityAdapterOptions<TEntity, TWorkingCopy>): EntityWorkingCopyAdapter<TEntity, TWorkingCopy>;
//# sourceMappingURL=adapter.d.ts.map