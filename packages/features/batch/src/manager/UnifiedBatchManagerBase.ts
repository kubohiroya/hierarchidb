import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import type { BatchProgressCallback, BatchProgressEvent, BatchSessionStatus, IBatchSessionManager } from '@hierarchidb/batch-api';

export interface UnifiedBatchSession<TConfig, TData> {
  config: TConfig;
  data: TData;
  storedAt: Timestamp;
}

export interface BatchPersistence<TConfig, TData> {
  savePending(nodeId: NodeId, payload: UnifiedBatchSession<TConfig, TData>): Promise<void> | void;
  takePending(nodeId: NodeId):
    | Promise<UnifiedBatchSession<TConfig, TData> | undefined>
    | UnifiedBatchSession<TConfig, TData>
    | undefined;
  onSessionStarted?(nodeId: NodeId, payload: UnifiedBatchSession<TConfig, TData>): Promise<void> | void;
  onSessionProgress?(nodeId: NodeId, event: BatchProgressEvent): Promise<void> | void;
  onSessionStatusChange?(nodeId: NodeId, status: BatchSessionStatus): Promise<void> | void;
  onSessionCompleted?(nodeId: NodeId): Promise<void> | void;
}

export abstract class UnifiedBatchManagerBase<TConfig, TData> implements IBatchSessionManager {
  private readonly pending = new Map<NodeId, UnifiedBatchSession<TConfig, TData>>();

  protected constructor(protected readonly persistence?: BatchPersistence<TConfig, TData>) {}

  async prepareSession(nodeId: NodeId, config: TConfig, data: TData): Promise<void> {
    const payload: UnifiedBatchSession<TConfig, TData> = {
      config,
      data,
      storedAt: Date.now() as Timestamp,
    };
    if (this.persistence) {
      await this.persistence.savePending(nodeId, payload);
    } else {
      this.pending.set(nodeId, payload);
    }
  }

  async startBatchSession(nodeId: NodeId): Promise<BatchSessionStatus> {
    const payload = this.persistence
      ? await this.persistence.takePending(nodeId)
      : this.pending.get(nodeId);
    if (!payload) {
      throw new Error(`No pending batch session for node ${nodeId}`);
    }
    if (!this.persistence) {
      this.pending.delete(nodeId);
    }

    const status = await this.performStart(nodeId, payload.config, payload.data);
    if (!status.nodeId) status.nodeId = nodeId;
    if (this.persistence?.onSessionStarted) {
      await this.persistence.onSessionStarted(nodeId, payload);
    }
    return status;
  }

  async pauseBatchSession(nodeId: NodeId): Promise<void> {
    await this.performPause(nodeId);
    await this.notifyStatus(nodeId);
  }

  async resumeBatchSession(nodeId: NodeId): Promise<void> {
    await this.performResume(nodeId);
    await this.notifyStatus(nodeId);
  }

  async getBatchSessionStatus(nodeId: NodeId): Promise<BatchSessionStatus> {
    return this.getBuildSessionStatus(nodeId);
  }

  async getBuildSessionStatus(nodeId: NodeId): Promise<BatchSessionStatus> {
    const status = await this.performStatus(nodeId);
    if (!status.nodeId) status.nodeId = nodeId;
    if (this.persistence?.onSessionStatusChange) {
      await this.persistence.onSessionStatusChange(nodeId, status);
    }
    return status;
  }

  onBatchProgress(nodeId: NodeId, callback: BatchProgressCallback): () => void {
    return this.performSubscribe(nodeId, (event: BatchProgressEvent) => {
      let nextEvent = event;
      if (!nextEvent.nodeId) {
        nextEvent = { ...nextEvent, nodeId };
      }
      callback(nextEvent);
      if (this.persistence?.onSessionProgress) {
        void this.persistence.onSessionProgress(nodeId, nextEvent);
      }
      if (nextEvent.phase === 'completed' || nextEvent.phase === 'failed') {
        if (this.persistence?.onSessionCompleted) {
          void this.persistence.onSessionCompleted(nodeId);
        }
      }
    });
  }

  protected abstract performStart(nodeId: NodeId, config: TConfig, data: TData): Promise<BatchSessionStatus>;
  protected abstract performPause(nodeId: NodeId): Promise<void>;
  protected abstract performResume(nodeId: NodeId): Promise<void>;
  protected abstract performStatus(nodeId: NodeId): Promise<BatchSessionStatus>;
  protected abstract performSubscribe(nodeId: NodeId, callback: BatchProgressCallback): () => void;

  private async notifyStatus(nodeId: NodeId): Promise<void> {
    if (!this.persistence?.onSessionStatusChange) return;
    const status = await this.performStatus(nodeId);
    if (!status.nodeId) status.nodeId = nodeId;
    await this.persistence.onSessionStatusChange(nodeId, status);
  }
}
