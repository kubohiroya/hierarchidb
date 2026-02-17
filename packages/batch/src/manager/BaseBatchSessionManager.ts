import type { NodeId } from '@hierarchidb/core-types';
import type { BatchProgressCallback, BatchProgressEvent, BatchSessionStatus, IBatchSessionManager } from '@hierarchidb/batch-api';
import { isBatchControlAPIV2Enabled } from '@hierarchidb/batch-api';
import type { AbstractBatchSession } from '../session/AbstractBatchSession.js';

/**
 * Base implementation for plugin batch session managers.
 * It tracks in-memory sessions and forwards progress callbacks.
 */
export abstract class BaseBatchSessionManager implements IBatchSessionManager {
  protected sessions = new Map<NodeId, AbstractBatchSession>();
  protected progressCallbacks = new Map<NodeId, Set<BatchProgressCallback>>();
  private sessionProgressTeardown = new Map<NodeId, () => void>();
  private lastPhaseBySession = new Map<NodeId, BatchProgressEvent['phase']>();

  abstract startBatchSession(nodeId: NodeId): Promise<BatchSessionStatus>;

  protected async onSessionRegistered(_session: AbstractBatchSession): Promise<void> {}
  protected async onSessionProgress(_session: AbstractBatchSession, _event: BatchProgressEvent): Promise<void> {}
  protected async onSessionStatusChange(_session: AbstractBatchSession): Promise<void> {}
  protected cleanupSessionTracking(nodeId: NodeId): void {
    this.lastPhaseBySession.delete(nodeId);
  }

  async pauseBatchSession(nodeId: NodeId): Promise<void> {
    const session = this.sessions.get(nodeId);
    if (!session) {
      throw new Error(`Session ${nodeId} not found`);
    }
    await session.pause();
    await this.onSessionStatusChange(session);
  }

  async resumeBatchSession(nodeId: NodeId): Promise<void> {
    const session = this.sessions.get(nodeId);
    if (!session) {
      throw new Error(`Session ${nodeId} not found`);
    }
    await session.resume();
    await this.onSessionStatusChange(session);
  }

  async getBatchSessionStatus(nodeId: NodeId): Promise<BatchSessionStatus> {
    const session = this.sessions.get(nodeId);
    if (!session) {
      throw new Error(`Session ${nodeId} not found`);
    }

    const state = session.getState();
    const progress = session.getProgress();

    return {
      nodeId: state.nodeId,
      status: state.status,
      progress,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      lastActivity: state.lastActivity,
      error: state.error,
    };
  }

  onBatchProgress(nodeId: NodeId, callback: BatchProgressCallback): () => void {
    let callbacks = this.progressCallbacks.get(nodeId);
    if (!callbacks) {
      callbacks = new Set();
      this.progressCallbacks.set(nodeId, callbacks);
    }
    callbacks.add(callback);

    return () => {
      const cbs = this.progressCallbacks.get(nodeId);
      if (!cbs) return;
      cbs.delete(callback);
      if (cbs.size === 0) {
        this.progressCallbacks.delete(nodeId);
      }
    };
  }

  protected emitProgress(nodeId: NodeId, event: BatchProgressEvent): void {
    const callbacks = this.progressCallbacks.get(nodeId);
    if (!callbacks) return;
    for (const callback of callbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    }
  }

  protected registerSession(session: AbstractBatchSession): void {
    const nodeId = session.getState().nodeId as NodeId;
    this.sessions.set(nodeId, session);
    void this.onSessionRegistered(session);

    const teardown = this.sessionProgressTeardown.get(nodeId);
    if (teardown) {
      teardown();
      this.sessionProgressTeardown.delete(nodeId);
    }

    const shouldEmit = isBatchControlAPIV2Enabled();
    const unsubscribe = session.addBatchProgressListener((event: BatchProgressEvent) => {
      if (shouldEmit) {
        this.emitProgress(nodeId, event);
      }
      void this.onSessionProgress(session, event);
      const lastPhase = this.lastPhaseBySession.get(nodeId);
      if (event.phase !== lastPhase) {
        this.lastPhaseBySession.set(nodeId, event.phase);
        void this.onSessionStatusChange(session);
      }
    });
    this.sessionProgressTeardown.set(nodeId, unsubscribe);
  }
}
