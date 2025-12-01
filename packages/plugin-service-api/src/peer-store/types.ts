import type { NodeId, TreeNodeMetadata } from '@hierarchidb/common-types';

export interface DialogWindowState {
  mode?: 'normal' | 'maximize' | 'full-screen';
  position?: { x: number; y: number } | null;
  size?: { width: number; height: number } | null;
}

export interface DialogProgressState {
  /**
   * Zero-based index of the last active step when the dialog was persisted.
   */
  activeStepIndex: number;
}

export interface PeerEntityBase<TData> {
  id: NodeId;
  metadata?: TreeNodeMetadata;
  data?: TData;
  updatedAt?: number;
  dialogWindow?: DialogWindowState | null;
  dialogProgress?: DialogProgressState | null;
}

export interface PeerStore<TData> {
  get(nodeId: NodeId): Promise<PeerEntityBase<TData> | undefined>;
  put(entity: PeerEntityBase<TData>): Promise<void>;
  delete(nodeId: NodeId): Promise<void>;
  bulkUpsert?(entities: PeerEntityBase<TData>[]): Promise<void>;
}
