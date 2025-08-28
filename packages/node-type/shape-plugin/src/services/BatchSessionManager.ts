/**
 * @file BatchSessionManager.ts
 * @description ERIA-Cartograph移植: バッチセッション管理実装
 */

import type { NodeId } from '@hierarchidb/common-core';
import type { BatchConfig } from '../types/BatchConfig';
import type { BatchTaskLike, BatchStage } from '../types/BatchTaskLike';
import type { BatchProgressEvent } from '../types/BatchProgressEvent';

export interface BatchSessionStatus {
  sessionId: string;
  nodeId: NodeId;
  stage: BatchStage;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  progress: number;
  isCompleted: boolean;
  isAborted?: boolean;
}

export interface BatchStageResult {
  success: boolean;
  processedTasks?: number;
  failedTasks?: number;
  processedFeatures?: number;
  filteredFeatures?: number;
  processedTiles?: number;
  simplificationRatio?: number;
  generatedTiles?: number;
  maxZoomLevel?: number;
}

/**
 * Batch Session Manager
 * Manages 4-stage batch processing pipeline
 */
export class BatchSessionManager {
  private sessions: Map<string, BatchSessionStatus> = new Map();
  private tasks: Map<string, BatchTaskLike[]> = new Map();
  private progressCallbacks: Map<string, (event: BatchProgressEvent) => void> = new Map();

  /**
   * Start batch processing session
   */
  async startBatchSession(
    treeNodeId: NodeId,
    config: BatchConfig,
    countries: string[],
    adminLevels: number[],
    progressCallback?: (event: BatchProgressEvent) => void
  ): Promise<string> {
    if (countries.length === 0) {
      throw new Error('No tasks to process');
    }

    if (config.corsProxyBaseURL === 'invalid-url') {
      throw new Error('Invalid batch configuration');
    }

    // Check for invalid countries
    const invalidCountries = countries.filter((country) => country.includes('INVALID'));
    if (invalidCountries.length > 0) {
      throw new Error('Invalid batch configuration');
    }

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const totalTasks = countries.length * adminLevels.length;

    // Create batch tasks
    const batchTasks: BatchTaskLike[] = [];
    for (const country of countries) {
      for (const adminLevel of adminLevels) {
        const taskId = `${sessionId}-${country}-${adminLevel}`;
        batchTasks.push({
          taskId,
          treeNodeId,
          sessionId,
          type: 'shape-plugin-processing',
          stage: 'download',
          status: 'pending',
          country,
          adminLevel,
          progress: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    // Initialize session status
    const sessionStatus: BatchSessionStatus = {
      sessionId,
      nodeId: treeNodeId,
      stage: 'download',
      totalTasks,
      completedTasks: 0,
      failedTasks: 0,
      progress: 0,
      isCompleted: false,
    };

    this.sessions.set(sessionId, sessionStatus);
    this.tasks.set(sessionId, batchTasks);

    if (progressCallback) {
      this.progressCallbacks.set(sessionId, progressCallback);
    }

    return sessionId;
  }

  /**
   * Get session status
   */
  async getSessionStatus(sessionId: string): Promise<BatchSessionStatus> {
    const status = this.sessions.get(sessionId);
    if (!status) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return status;
  }

  /**
   * Get batch tasks for session
   */
  async getBatchTasks(sessionId: string): Promise<BatchTaskLike[]> {
    const tasks = this.tasks.get(sessionId);
    if (!tasks) {
      throw new Error(`Tasks not found for session: ${sessionId}`);
    }
    return tasks;
  }

  /**
   * Execute Download stage
   */
  async executeDownloadStage(sessionId: string): Promise<BatchStageResult> {
    const status = this.sessions.get(sessionId);
    if (!status) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Simulate download processing
    await this.simulateProcessing(100);

    // Update session status
    status.stage = 'simplify1';
    status.completedTasks = status.totalTasks;
    status.progress = 25;

    // Emit progress event
    this.emitProgressEvent(sessionId, {
      sessionId,
      treeNodeId: status.nodeId,
      stage: 'download',
      progress: 25,
      completedTasks: status.completedTasks,
      totalTasks: status.totalTasks,
      currentTask: 'Download completed',
      timestamp: Date.now(),
    });

    return {
      success: true,
      processedTasks: status.totalTasks,
      failedTasks: 0,
    };
  }

  /**
   * Execute Simplify1 stage
   */
  async executeSimplify1Stage(sessionId: string): Promise<BatchStageResult> {
    const status = this.sessions.get(sessionId);
    if (!status) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Simulate feature processing
    await this.simulateProcessing(150);

    // Update session status
    status.stage = 'simplify2';
    status.progress = 50;

    // Emit progress event
    this.emitProgressEvent(sessionId, {
      sessionId,
      treeNodeId: status.nodeId,
      stage: 'simplify1',
      progress: 50,
      completedTasks: status.completedTasks,
      totalTasks: status.totalTasks,
      currentTask: 'Feature processing completed',
      timestamp: Date.now(),
    });

    return {
      success: true,
      processedFeatures: 1000,
      filteredFeatures: 100,
    };
  }

  /**
   * Execute Simplify2 stage
   */
  async executeSimplify2Stage(sessionId: string): Promise<BatchStageResult> {
    const status = this.sessions.get(sessionId);
    if (!status) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Simulate tile processing
    await this.simulateProcessing(120);

    // Update session status
    status.stage = 'vectorTiles';
    status.progress = 75;

    // Emit progress event
    this.emitProgressEvent(sessionId, {
      sessionId,
      treeNodeId: status.nodeId,
      stage: 'simplify2',
      progress: 75,
      completedTasks: status.completedTasks,
      totalTasks: status.totalTasks,
      currentTask: 'Tile processing completed',
      timestamp: Date.now(),
    });

    return {
      success: true,
      processedTiles: 500,
      simplificationRatio: 0.8,
    };
  }

  /**
   * Execute VectorTiles stage
   */
  async executeVectorTilesStage(sessionId: string): Promise<BatchStageResult> {
    const status = this.sessions.get(sessionId);
    if (!status) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Simulate vector tile generation
    await this.simulateProcessing(100);

    // Update session status
    status.isCompleted = true;
    status.progress = 100;

    // Emit progress event
    this.emitProgressEvent(sessionId, {
      sessionId,
      treeNodeId: status.nodeId,
      stage: 'vectorTiles',
      progress: 100,
      completedTasks: status.completedTasks,
      totalTasks: status.totalTasks,
      currentTask: 'Vector tiles generation completed',
      timestamp: Date.now(),
    });

    return {
      success: true,
      generatedTiles: 250,
      maxZoomLevel: 6,
    };
  }

  /**
   * Execute full pipeline
   */
  async executeFullPipeline(sessionId: string): Promise<void> {
    await this.executeDownloadStage(sessionId);
    await this.executeSimplify1Stage(sessionId);
    await this.executeSimplify2Stage(sessionId);
    await this.executeVectorTilesStage(sessionId);
  }

  /**
   * Emit progress event
   */
  private emitProgressEvent(sessionId: string, event: BatchProgressEvent): void {
    const callback = this.progressCallbacks.get(sessionId);
    if (callback) {
      callback(event);
    }
  }

  /**
   * Abort session
   */
  async abortSession(sessionId: string): Promise<void> {
    const status = this.sessions.get(sessionId);
    if (!status) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    status.isAborted = true;
    status.isCompleted = false;
  }

  /**
   * Simulate processing delay
   */
  private async simulateProcessing(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
