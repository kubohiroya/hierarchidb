/**
 * Unified Batch Control Facade for Shape Plugin
 * Provides standardized batch control API while maintaining backward compatibility
 */

import type { NodeId } from '@hierarchidb/common-types';
import type {
  BatchProgressCallback,
  BatchSessionStatus,
  BatchProgressEvent,
  IBatchSessionManager,
  ProgressPhase,
} from '@hierarchidb/runtime-shared-batch-processor';
import { isBatchControlAPIV2Enabled } from '@hierarchidb/runtime-shared-batch-processor';
import { BatchSessionManager, type BatchSessionOptions } from './BatchSessionManager.js';
import type { BatchProcessConfig } from './types.js';
import type { UrlMetadata } from '../../shared/types.js';

/**
 * Unified shape batch manager implementing the standard interface
 */
export class UnifiedShapeBatchManager implements IBatchSessionManager {
  private manager: BatchSessionManager;
  private pending = new Map<NodeId, { config: ShapeBatchConfig; data: ShapeBatchData }>();
  private sessionNodes = new Map<string, NodeId>();

  constructor() {
    this.manager = new BatchSessionManager();

    // Initialize manager
    this.manager.initialize().catch(console.error);
  }

  prepareSession(nodeId: NodeId, config: ShapeBatchConfig, data: ShapeBatchData): void {
    this.pending.set(nodeId, { config, data });
  }

  async startBatchSession(nodeId: NodeId): Promise<string> {
    const pending = this.pending.get(nodeId);
    if (!pending) {
      throw new Error(`No pending shape batch session data for node ${nodeId}`);
    }
    this.pending.delete(nodeId);
    const { config, data } = pending;
    if (!data.urlMetadata?.length) {
      throw new Error('Shape batch session requires urlMetadata');
    }

    // Convert unified config to shape-specific config
    const batchProcessConfig: BatchProcessConfig = {
      corsProxyBaseURL: config.corsProxyBaseURL ?? '',
      download: {
        concurrentDownloads: 1,
        deleteOnComplete: false,
      },
      simplify1: {
        concurrentProcesses: 1,
        enableFeatureFiltering: false,
        featureAreaThreshold: 0,
        minVertexCountForAreaFilter: 0,
        aspectRatioThreshold: 1,
        featureFilterMethod: 'bbox_only',
      },
      simplify2: {
        concurrentProcesses: 1,
        quantize: 1,
        simplify: 1,
        tolerance: 1,
        enablePerFeatureSimplification: false,
      },
      vectorTiles: {
        concurrentProcesses: 1,
        maxZoom: 1,
        tileCountThresholdForZoomStop: 1000,
      },
    };

    const options: BatchSessionOptions = {
      maxConcurrentTasks: config.maxConcurrentTasks,
      retryAttempts: config.maxRetries,
      timeoutMs: config.workerTimeout,
      enableResourceTracking: config.enableResourceMonitoring,
    };

    const session = await this.manager.createSession(nodeId, batchProcessConfig, data.urlMetadata, options);
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
    this.manager.onProgress(sessionId, (progress) => {
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
    return () => {
    };
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
 * Shape-specific configuration interface
 */
export interface ShapeBatchConfig {
  corsProxyBaseURL?: string;
  maxRetries?: number;
  retryDelay?: number;
  workerTimeout?: number;
  maxMemoryPerWorker?: number;
  maxConcurrentTasks?: number;
  enableProgressTracking?: boolean;
  enableResourceMonitoring?: boolean;
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

/**
 * Feature flag check for shape plugin specifically
 */
export function isShapeBatchAPIV2Enabled(): boolean {
  return isBatchControlAPIV2Enabled();
}
