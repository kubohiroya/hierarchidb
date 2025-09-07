/**
 * Unified Batch Control Facade for Shape Plugin
 * Provides standardized batch control API while maintaining backward compatibility
 */

import type { NodeId } from '@hierarchidb/common-type';
import type { IBatchSessionManager, BatchSessionStatus, BatchProgressCallback } from '@hierarchidb/runtime-shared-batch-processor';
import { isBatchControlAPIV2Enabled } from '@hierarchidb/runtime-shared-batch-processor';
import { createUnifiedBatchManagerFacade } from '@hierarchidb/runtime-shared-batch-processor';
import { BatchSessionManager, type BatchSessionOptions } from './BatchSessionManager';
import type { BatchProcessConfig } from './types';
import type { UrlMetadata } from '../../types';

/**
 * Unified shape batch manager implementing the standard interface
 */
export class UnifiedShapeBatchManager implements IBatchSessionManager {
  private manager: BatchSessionManager;
  private facade: IBatchSessionManager;

  constructor() {
    this.manager = new BatchSessionManager();
    
    // Initialize manager
    this.manager.initialize().catch(console.error);
    
    // Create facade using the factory function
    this.facade = createUnifiedBatchManagerFacade(this.manager, {
      startMethod: 'createSession',
      pauseMethod: 'pauseSession',
      resumeMethod: 'resumeSession',
      cancelMethod: 'cancelSession',
      statusMethod: 'getSessionStatus',
      progressMethod: 'onProgress',
    });
  }

  async startBatchSession(nodeId: NodeId, config: ShapeBatchConfig, data?: ShapeBatchData): Promise<string> {
    if (!data || !data.urlMetadata) {
      throw new Error('Shape batch session requires urlMetadata');
    }

    // Convert unified config to shape-specific config
    const batchProcessConfig: BatchProcessConfig = {
      corsProxyBaseURL: config.corsProxyBaseURL,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      // Add shape-specific mappings as needed
    };

    const options: BatchSessionOptions = {
      maxConcurrentTasks: config.maxConcurrentTasks,
      retryAttempts: config.maxRetries,
      timeoutMs: config.workerTimeout,
      enableResourceTracking: config.enableResourceMonitoring,
    };

    const session = await this.manager.createSession(nodeId, batchProcessConfig, data.urlMetadata, options);
    return session.sessionId;
  }

  async pauseBatchSession(sessionId: string): Promise<void> {
    return this.manager.pauseSession(sessionId);
  }

  async resumeBatchSession(sessionId: string): Promise<void> {
    return this.manager.resumeSession(sessionId);
  }

  async cancelBatchSession(sessionId: string): Promise<void> {
    return this.manager.cancelSession(sessionId);
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
      error: status.errors.length > 0 ? status.errors[0].error : undefined,
    };
  }

  onBatchProgress(sessionId: string, callback: BatchProgressCallback): () => void {
    this.manager.onProgress(sessionId, (progress) => {
      // Convert shape-specific progress to standard format
      callback({
        sessionId,
        stage: progress.currentStage || 'processing',
        total: progress.total,
        completed: progress.completed,
        failed: progress.failed,
        percentage: progress.percentage,
        currentTask: progress.currentTask,
        estimatedTimeRemaining: progress.estimatedTimeRemaining,
      });
    });

    // Return unsubscribe function (shape manager doesn't provide one, so we return a no-op)
    return () => {};
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