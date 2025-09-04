/**
 * Minimal batch processing shims to decouple from shape-plugin during typecheck.
 * Provides only the surface used by RouteBatchManager.
 */

import type { NodeId } from '@hierarchidb/common-type';

export type BatchStage = string;

export interface BatchProgressEvent {
  sessionId: string;
  stage: BatchStage;
  progress: number; // 0-100
  completedTasks: number;
  totalTasks: number;
  message?: string;
}

export interface BatchTaskLike {
  taskId: string;
  treeNodeId: NodeId;
  sessionId: string;
  stage: BatchStage;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  country?: string;
  adminLevel?: number;
  index?: number;
  error?: string;
}

export interface BatchConfig {
  // Keep open; RouteBatchManager only forwards config object
  [key: string]: unknown;
}

export abstract class BatchSessionManager {
  private configBySession = new Map<string, BatchConfig>();

  async startBatchSession(
    _nodeId: NodeId,
    config: BatchConfig,
    _countries: unknown[],
    _adminLevels: unknown[]
  ): Promise<string> {
    const id = crypto.randomUUID();
    this.configBySession.set(id, config);
    return id;
  }

  protected getSessionConfig(sessionId: string): BatchConfig | undefined {
    return this.configBySession.get(sessionId);
  }

  protected notifyProgress(_sessionId: string, _event: BatchProgressEvent): void {
    // no-op shim
  }
}

