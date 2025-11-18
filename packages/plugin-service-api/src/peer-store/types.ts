import type { NodeId } from '@hierarchidb/common-types';

/**
 * Minimal shape for peer data persisted by plugin-loader.
 */
export interface PeerDataBase {
  schemaVersion: number;
  metadata?: Record<string, unknown>;
}

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

export interface PeerEntityBase<TData extends PeerDataBase = PeerDataBase> {
  nodeId: NodeId;
  data?: TData;
  updatedAt?: number;
  dialogWindow?: DialogWindowState | null;
  dialogProgress?: DialogProgressState | null;
}

export interface PeerStore<TData extends PeerDataBase = PeerDataBase> {
  get(nodeId: NodeId): Promise<PeerEntityBase<TData> | undefined>;
  put(entity: PeerEntityBase<TData>): Promise<void>;
  delete(nodeId: NodeId): Promise<void>;
  bulkUpsert?(entities: PeerEntityBase<TData>[]): Promise<void>;
}
