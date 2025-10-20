import type { NodeId, Timestamp,
} from '@hierarchidb/common-types';
import { BatchProgressCallback, BatchProgressEvent, BatchSessionId, BatchSessionStatus, IBatchSessionManager } from '@hierarchidb/common-api';

export interface UnifiedBatchSession<TConfig, TData> {
  config: TConfig;
  data: TData;
  storedAt: Timestamp;
}

export interface BatchPersistence<TConfig, TData> {
  savePending(nodeId: NodeId, payload: UnifiedBatchSession<TConfig, TData>): Promise<void> | void;
  takePending(nodeId: NodeId): Promise<UnifiedBatchSession<TConfig, TData> | undefined> | UnifiedBatchSession<TConfig, TData> | undefined;
  onSessionStarted?(sessionId: BatchSessionId, nodeId: NodeId, payload: UnifiedBatchSession<TConfig, TData>): Promise<void> | void;
  onSessionProgress?(sessionId: BatchSessionId, event: BatchProgressEvent): Promise<void> | void;
  onSessionStatusChange?(sessionId: BatchSessionId, status: BatchSessionStatus): Promise<void> | void;
  onSessionCompleted?(sessionId: BatchSessionId): Promise<void> | void;
}

export abstract class UnifiedBatchManagerBase<TConfig, TData> implements IBatchSessionManager {
  protected readonly persistence?: BatchPersistence<TConfig, TData>;
  private readonly pending = new Map<NodeId, UnifiedBatchSession<TConfig, TData>>();
  private readonly sessions = new Map<BatchSessionId, NodeId>();

  constructor(persistence?: BatchPersistence<TConfig, TData>) {
    this.persistence = persistence;
  }

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

  async startBatchSession(nodeId: NodeId): Promise<BatchSessionId> {
    const payload = this.persistence
      ? await this.persistence.takePending(nodeId)
      : this.pending.get(nodeId);
    if (!payload) {
      throw new Error(`No pending batch session for node ${nodeId}`);
    }
    if (!this.persistence) {
      this.pending.delete(nodeId);
    }

    const sessionId = await this.performStart(nodeId, payload.config, payload.data);
    this.sessions.set(sessionId, nodeId);
    if (this.persistence?.onSessionStarted) {
      await this.persistence.onSessionStarted(sessionId, nodeId, payload);
    }
    return sessionId;
  }

  async pauseBatchSession(sessionId: BatchSessionId): Promise<void> {
    await this.performPause(sessionId);
    await this.notifyStatus(sessionId);
  }

  async resumeBatchSession(sessionId: BatchSessionId): Promise<void> {
    await this.performResume(sessionId);
    await this.notifyStatus(sessionId);
  }

  async cancelBatchSession(sessionId: BatchSessionId): Promise<void> {
    await this.performCancel(sessionId);
    this.sessions.delete(sessionId);
    if (this.persistence?.onSessionCompleted) {
      await this.persistence.onSessionCompleted(sessionId);
    }
  }

  async getBatchSessionStatus(sessionId: BatchSessionId): Promise<BatchSessionStatus> {
    const status = await this.performStatus(sessionId);
    if (!status.nodeId) {
      const nodeId = this.sessions.get(sessionId);
      if (nodeId) {
        status.nodeId = nodeId;
      }
    }
    if (this.persistence?.onSessionStatusChange) {
      await this.persistence.onSessionStatusChange(sessionId, status);
    }
    return status;
  }

  onBatchProgress(sessionId: BatchSessionId, callback: BatchProgressCallback): () => void {
    const nodeId = this.sessions.get(sessionId);
    return this.performSubscribe(sessionId, (event: BatchProgressEvent) => {
      if (!event.nodeId && nodeId) {
        event = { ...event, nodeId };
      }
      callback(event);
      if (this.persistence?.onSessionProgress) {
          void this.persistence.onSessionProgress(sessionId, event);
      }
      if (event.phase === 'completed' || event.phase === 'failed') {
        this.sessions.delete(sessionId);
        if (this.persistence?.onSessionCompleted) {
          void this.persistence.onSessionCompleted(sessionId);
        }
      }
    });
  }

  protected abstract performStart(nodeId: NodeId, config: TConfig, data: TData): Promise<BatchSessionId>;
  protected abstract performPause(sessionId: BatchSessionId): Promise<void>;
  protected abstract performResume(sessionId: BatchSessionId): Promise<void>;
  protected abstract performCancel(sessionId: BatchSessionId): Promise<void>;
  protected abstract performStatus(sessionId: BatchSessionId): Promise<BatchSessionStatus>;
  protected abstract performSubscribe(sessionId: BatchSessionId, callback: BatchProgressCallback): () => void;

  private async notifyStatus(sessionId: BatchSessionId): Promise<void> {
    if (!this.persistence?.onSessionStatusChange) return;
    const status = await this.performStatus(sessionId);
    if (!status.nodeId) {
      const nodeId = this.sessions.get(sessionId);
      if (nodeId) {
        status.nodeId = nodeId;
      }
    }
    await this.persistence.onSessionStatusChange(sessionId, status);
  }
}
