import type { NodeId } from '@hierarchidb/common-types';
import type { MultiStepDialogState } from '@hierarchidb/common-types';
/**
 * Minimal shape for peer data persisted by plugin-loader.
 */
export interface PeerDataBase {
    schemaVersion: number;
    metadata?: Record<string, unknown>;
}
export interface PeerEntityBase<TData extends PeerDataBase = PeerDataBase> {
    nodeId: NodeId;
    data: TData;
    updatedAt?: number;
    displayMode?: 'normal' | 'maximize' | 'full-screen';
    dialogPosition?: {
        x: number;
        y: number;
    } | null;
    dialogSize?: {
        width: number;
        height: number;
    } | null;
    dialogState?: MultiStepDialogState | null;
}
export interface PeerStore<TData extends PeerDataBase = PeerDataBase> {
    get(nodeId: NodeId): Promise<PeerEntityBase<TData> | undefined>;
    put(entity: PeerEntityBase<TData>): Promise<void>;
    delete(nodeId: NodeId): Promise<void>;
    bulkUpsert?(entities: PeerEntityBase<TData>[]): Promise<void>;
}
//# sourceMappingURL=types.d.ts.map