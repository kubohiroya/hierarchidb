/**
 * Base Batch Manager Implementation
 * Provides common implementation for batch session managers
 */

import type { NodeId,
} from '@hierarchidb/common-types';
import type { AbstractBatchSession } from './AbstractBatchSession.js';
import { BatchProgressCallback, BatchProgressEvent, BatchSessionId, BatchSessionStatus, IBatchSessionManager, isBatchControlAPIV2Enabled } from '@hierarchidb/common-api';

/**
 * Base implementation for batch session managers
 * Provides common functionality that can be extended by plugin-specific managers
 */
export abstract class BaseBatchSessionManager implements IBatchSessionManager {
  protected sessions = new Map<BatchSessionId, AbstractBatchSession>();
  protected progressCallbacks = new Map<BatchSessionId, Set<BatchProgressCallback>>();
  private sessionProgressTeardown = new Map<BatchSessionId, () => void>();

  abstract startBatchSession(nodeId: NodeId): Promise<BatchSessionId>;

  async pauseBatchSession(sessionId: BatchSessionId): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    await session.pause();
  }

  async resumeBatchSession(sessionId: BatchSessionId): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    await session.resume();
  }

  async cancelBatchSession(sessionId: BatchSessionId): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    await session.cancel();
    this.sessions.delete(sessionId);
    this.progressCallbacks.delete(sessionId);
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

    const teardown = this.sessionProgressTeardown.get(sessionId);
    if (teardown) {
      teardown();
      this.sessionProgressTeardown.delete(sessionId);
    }

    // Set up progress forwarding if API v2 is enabled
    if (isBatchControlAPIV2Enabled()) {
      const unsubscribe = session.addBatchProgressListener((event: BatchProgressEvent) => {
        this.emitProgress(sessionId, event);
      });
      this.sessionProgressTeardown.set(sessionId, unsubscribe);
    }
  }
}
