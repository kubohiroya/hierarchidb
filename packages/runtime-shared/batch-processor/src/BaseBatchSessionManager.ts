/**
 * Base Batch Manager Implementation
 * Provides common implementation for batch session managers
 */

import type { NodeId } from '@hierarchidb/common-type';
import type {
  BatchProgressCallback,
  BatchSessionStatus,
  IBatchSessionManager,
  StandardProgressEvent,
} from './BatchControlAPI.js';
import { isBatchControlAPIV2Enabled } from './BatchControlAPI.js';
import type { AbstractBatchSession } from './AbstractBatchSession.js';

/**
 * Base implementation for batch session managers
 * Provides common functionality that can be extended by plugin-specific managers
 */
export abstract class BaseBatchSessionManager implements IBatchSessionManager {
  protected sessions = new Map<string, AbstractBatchSession>();
  protected progressCallbacks = new Map<string, Set<BatchProgressCallback>>();
  private sessionProgressTeardown = new Map<string, () => void>();

  abstract startBatchSession(nodeId: NodeId, config: any, data?: any): Promise<string>;

  async pauseBatchSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    await session.pause();
  }

  async resumeBatchSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    await session.resume();
  }

  async cancelBatchSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    await session.cancel();
    this.sessions.delete(sessionId);
    this.progressCallbacks.delete(sessionId);
  }

  async getBatchSessionStatus(sessionId: string): Promise<BatchSessionStatus> {
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

  onBatchProgress(sessionId: string, callback: BatchProgressCallback): () => void {
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
  protected emitProgress(sessionId: string, event: StandardProgressEvent): void {
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
    const sessionId = session.getState().sessionId;
    this.sessions.set(sessionId, session);

    const teardown = this.sessionProgressTeardown.get(sessionId);
    if (teardown) {
      teardown();
      this.sessionProgressTeardown.delete(sessionId);
    }

    // Set up progress forwarding if API v2 is enabled
    if (isBatchControlAPIV2Enabled()) {
      const unsubscribe = session.addStandardProgressListener((event: StandardProgressEvent) => {
        this.emitProgress(sessionId, event);
      });
      this.sessionProgressTeardown.set(sessionId, unsubscribe);
    }
  }

  /**
   * Clean up completed or failed sessions
   */
  protected cleanupSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.progressCallbacks.delete(sessionId);
    const teardown = this.sessionProgressTeardown.get(sessionId);
    if (teardown) {
      teardown();
      this.sessionProgressTeardown.delete(sessionId);
    }
  }
}

/**
 * Factory function to create unified facades for existing managers
 */
export function createUnifiedBatchManagerFacade<TManager extends Record<string, any>>(
  existingManager: TManager,
  mappings: {
    startMethod: string;
    pauseMethod: string;
    resumeMethod: string;
    cancelMethod?: string;
    statusMethod?: string;
    progressMethod?: string;
  },
): IBatchSessionManager {
  return {
    async startBatchSession(nodeId: NodeId, config: any, data?: any): Promise<string> {
      return await existingManager[mappings.startMethod](nodeId, config, data);
    },

    async pauseBatchSession(sessionId: string): Promise<void> {
      return await existingManager[mappings.pauseMethod](sessionId);
    },

    async resumeBatchSession(sessionId: string): Promise<void> {
      return await existingManager[mappings.resumeMethod](sessionId);
    },

    async cancelBatchSession(sessionId: string): Promise<void> {
      if (mappings.cancelMethod) {
        return await existingManager[mappings.cancelMethod](sessionId);
      }
      throw new Error('Cancel not supported by this manager');
    },

    async getBatchSessionStatus(sessionId: string): Promise<BatchSessionStatus> {
      if (mappings.statusMethod) {
        const status = await existingManager[mappings.statusMethod](sessionId);
        // Convert to standard format
        return {
          sessionId,
          nodeId: status.nodeId || status.treeNodeId,
          status: status.status || 'running',
          progress: {
            total: status.total || status.progress?.total || 0,
            completed: status.completed || status.progress?.completed || 0,
            failed: status.failed || status.progress?.failed || 0,
            percentage: status.percentage || status.progress?.percentage || 0,
            currentStage: status.stage || status.progress?.currentStage || 'processing',
            currentTask: status.currentTask || status.progress?.currentTask,
          },
          startedAt: status.startedAt,
          completedAt: status.completedAt,
          lastActivity: status.lastActivity,
          error: status.error,
        };
      }
      throw new Error('Status not supported by this manager');
    },

    onBatchProgress(sessionId: string, callback: BatchProgressCallback): () => void {
      if (mappings.progressMethod) {
        return existingManager[mappings.progressMethod](sessionId, callback);
      }
      throw new Error('Progress monitoring not supported by this manager');
    },
  };
}
