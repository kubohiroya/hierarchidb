/**
 * Base Batch Manager Implementation
 * Provides _obsolate_common implementation for batch session managers
 */

import type { NodeId} from '@hierarchidb/common-types';
import type { AbstractBatchSession } from './AbstractBatchSession.js';
import { type BatchProgressCallback, type BatchProgressEvent, type BatchSessionId, type BatchSessionStatus, type IBatchSessionManager, isBatchControlAPIV2Enabled } from '@hierarchidb/common-api';

/**
 * Base implementation for batch session managers
 * Provides _obsolate_common functionality that can be extended by plugin-specific managers
 */
export abstract class BaseBatchSessionManager implements IBatchSessionManager {
  protected sessions = new Map<BatchSessionId, AbstractBatchSession>();
  protected progressCallbacks = new Map<BatchSessionId, Set<BatchProgressCallback>>();
  private sessionProgressTeardown = new Map<BatchSessionId, () => void>();
  private lastPhaseBySession = new Map<BatchSessionId, BatchProgressEvent['phase']>();

  abstract startBatchSession(nodeId: NodeId): Promise<BatchSessionId>;

  protected async onSessionRegistered(_session: AbstractBatchSession): Promise<void> {}
  protected async onSessionProgress(_session: AbstractBatchSession, _event: BatchProgressEvent): Promise<void> {}
  protected async onSessionStatusChange(_session: AbstractBatchSession): Promise<void> {}
  protected cleanupSessionTracking(sessionId: BatchSessionId): void {
    this.lastPhaseBySession.delete(sessionId);
  }

  async pauseBatchSession(sessionId: BatchSessionId): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    await session.pause();
    await this.onSessionStatusChange(session);
  }

  async resumeBatchSession(sessionId: BatchSessionId): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    await session.resume();
    await this.onSessionStatusChange(session);
  }

  async cancelBatchSession(sessionId: BatchSessionId): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    await session.cancel();
    await this.onSessionStatusChange(session);
    this.sessions.delete(sessionId);
    this.progressCallbacks.delete(sessionId);
    this.cleanupSessionTracking(sessionId);
  }

  async getBatchSessionStatus(sessionId: BatchSessionId): Promise<BatchSessionStatus> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const state = session.getState();
    const progress = session.getProgress();

    return {
      sessionId: state.sessionId,
      nodeId: state.nodeId,
      status: state.status,
      progress,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      lastActivity: state.lastActivity,
      error: state.error,
    };
  }

  onBatchProgress(sessionId: BatchSessionId, callback: BatchProgressCallback): () => void {
    let callbacks = this.progressCallbacks.get(sessionId);
    if (!callbacks) {
      callbacks = new Set();
      this.progressCallbacks.set(sessionId, callbacks);
    }
    callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      const cbs = this.progressCallbacks.get(sessionId);
      if (cbs) {
        cbs.delete(callback);
        if (cbs.size === 0) {
          this.progressCallbacks.delete(sessionId);
        }
      }
    };
  }

  /**
   * Emit progress to all registered callbacks for a session
   */
  protected emitProgress(sessionId: BatchSessionId, event: BatchProgressEvent): void {
    const callbacks = this.progressCallbacks.get(sessionId);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in progress callback:', error);
        }
      }
    }
  }

  /**
   * Register a session and set up progress forwarding
   */
  protected registerSession(session: AbstractBatchSession): void {
    const sessionId = session.getState().sessionId as BatchSessionId;
    this.sessions.set(sessionId, session);
    void this.onSessionRegistered(session);

    const teardown = this.sessionProgressTeardown.get(sessionId);
    if (teardown) {
      teardown();
      this.sessionProgressTeardown.delete(sessionId);
    }

    const shouldEmit = isBatchControlAPIV2Enabled();
    const unsubscribe = session.addBatchProgressListener((event: BatchProgressEvent) => {
      if (shouldEmit) {
        this.emitProgress(sessionId, event);
      }
      void this.onSessionProgress(session, event);
      const lastPhase = this.lastPhaseBySession.get(sessionId);
      if (event.phase !== lastPhase) {
        this.lastPhaseBySession.set(sessionId, event.phase);
        void this.onSessionStatusChange(session);
      }
    });
    this.sessionProgressTeardown.set(sessionId, unsubscribe);
  }
}
