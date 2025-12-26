/**
 * Unified Batch Control Facade for Shape Plugin
 * Provides standardized batch control API while maintaining backward compatibility
 */

import type { NodeId } from '@hierarchidb/common-types';
import {
  type BatchProgressCallback,
  type BatchProgressEvent,
  type BatchSessionStatus,
  type IBatchSessionManager,
  type ProgressPhase,
} from '@hierarchidb/common-api';
import { BatchSessionManager, type BatchSessionOptions } from './BatchSessionManager.js';
import type { BatchProcessConfig } from './types.js';
import type { UrlMetadata } from '../../common/types/index.js';

/**
 * Unified shape batch manager implementing the standard interface
 */
export class UnifiedShapeBatchManager implements IBatchSessionManager {
  private manager: BatchSessionManager;
  private pending = new Map<NodeId, {
    config: BatchProcessConfig;
    data: ShapeBatchData;
    options?: BatchSessionOptions;
  }>();
  private sessionNodes = new Map<string, NodeId>();

  constructor() {
    this.manager = new BatchSessionManager();

    // Initialize manager
    this.manager.initialize().catch(console.error);
  }

  prepareSession(
    nodeId: NodeId,
    config: BatchProcessConfig,
    data: ShapeBatchData,
    options?: BatchSessionOptions,
  ): void {
    this.pending.set(nodeId, { config, data, options });
  }

  async startBatchSession(nodeId: NodeId): Promise<string> {
    const pending = this.pending.get(nodeId);
    if (!pending) {
      throw new Error(`No pending shape batch session data for node ${nodeId}`);
    }
    this.pending.delete(nodeId);
    const { config, data, options } = pending;
    if (!data.urlMetadata?.length) {
      throw new Error('Shape batch session requires urlMetadata');
    }

    const session = await this.manager.createSession(
      nodeId,
      config,
      data.urlMetadata,
      options ?? {}
    );
    const sessionId = session.sessionId;
    if (!sessionId) {
      throw new Error('Failed to create shape batch session: missing sessionId');
    }
    this.sessionNodes.set(sessionId, nodeId);
    return sessionId;
  }

  async pauseBatchSession(sessionId: string): Promise<void> {
    return this.manager.pauseSession(sessionId);
  }

  async resumeBatchSession(sessionId: string): Promise<void> {
    return this.manager.resumeSession(sessionId);
  }

  async cancelBatchSession(sessionId: string): Promise<void> {
    await this.manager.cancelSession(sessionId);
    this.sessionNodes.delete(sessionId);
  }

  async getBatchSessionStatus(sessionId: string): Promise<BatchSessionStatus> {
    const status = await this.manager.getSessionStatus(sessionId);

    // Convert shape-specific status to standard format
    return {
      sessionId: status.session.sessionId,
      nodeId: status.session.nodeId,
      status: status.session.status,
      progress: status.session.progress,
      startedAt: status.session.startedAt,
      completedAt: status.session.completedAt,
      lastActivity: status.session.updatedAt,
      error: status.errors && status.errors.length > 0 ? status.errors[0]?.error : undefined,
    };
  }

  onBatchProgress(sessionId: string, callback: BatchProgressCallback): () => void {
    const unsubscribe = this.manager.onProgress(sessionId, (progress) => {
      const nodeId = this.sessionNodes.get(sessionId);
      if (!nodeId) {
        return;
      }

      const total = progress.total ?? 0;
      const completed = progress.completed ?? 0;
      const failed = progress.failed ?? 0;
      const skipped = progress.skipped ?? 0;

      const phase = this.resolveProgressPhase({ total, completed, failed, percentage: progress.percentage });

      const payload: NonNullable<BatchProgressEvent['payload']> = {
        total,
        completed,
        failed,
        skipped,
        currentTask: progress.currentTask,
        meta: {
          percentage: progress.percentage,
        },
      };

      const event: Parameters<BatchProgressCallback>[0] = {
        sessionId,
        nodeId,
        stage: progress.currentStage || 'processing',
        phase,
        timestamp: Date.now(),
        payload,
        message: typeof progress.currentTask === 'string' ? progress.currentTask : undefined,
      };

      callback(event);

      if (phase === 'completed' || phase === 'failed') {
        this.sessionNodes.delete(sessionId);
      }
    });

    // Return unsubscribe function (shape manager doesn't provide one, so we return a no-op)
    return unsubscribe;
  }

  private resolveProgressPhase(progress: {
    total: number;
    completed: number;
    failed: number;
    percentage?: number;
  }): ProgressPhase {
    if (progress.failed > 0) {
      return 'failed';
    }

    if (progress.total > 0 && progress.completed >= progress.total) {
      return 'completed';
    }

    if ((progress.percentage ?? 0) <= 0 && progress.completed === 0) {
      return 'queued';
    }

    return 'running';
  }
}

/**
 * Shape-specific data interface
 */
export interface ShapeBatchData {
  urlMetadata: UrlMetadata[];
}

/**
 * Factory function to get the appropriate batch manager
 * Returns the unified manager if API v2 is enabled, otherwise returns a wrapper around the legacy manager
 */
export function createShapeBatchManager(): IBatchSessionManager {
  return new UnifiedShapeBatchManager();
}
