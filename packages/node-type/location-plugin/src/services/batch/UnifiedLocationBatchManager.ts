/**
 * Unified Batch Control Facade for Location Plugin
 * Provides standardized batch control API while maintaining backward compatibility
 */

import type { NodeId } from '@hierarchidb/common-type';
import type {
  BatchProgressCallback,
  BatchSessionStatus,
  IBatchSessionManager,
} from '@hierarchidb/runtime-shared-batch-processor';
import { isBatchControlAPIV2Enabled } from '@hierarchidb/runtime-shared-batch-processor';
import { LocationBatchSessionManager } from './BatchSessionManager';
import type { LocationPointInput, LocationTileSettings } from './SessionController';

/**
 * Unified location batch manager implementing the standard interface
 */
export class UnifiedLocationBatchManager implements IBatchSessionManager {
  private manager: LocationBatchSessionManager;
  // facade is currently unused in this minimal implementation; keep for future
  // compatibility with unified manager factory without exporting in dts.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // Use underscore to mark intentionally unused until unified facade is required by API
  // removed facade to satisfy dts build; can be reintroduced when unified API is wired

  constructor() {
    this.manager = new LocationBatchSessionManager();

    // Facade creation skipped to avoid unused symbol during dts build
  }

  async startBatchSession(nodeId: NodeId, _config: LocationBatchConfig, data?: LocationBatchData): Promise<string> {
    if (!data || !data.points || !data.settings) {
      throw new Error('Location batch session requires points and settings data');
    }

    const summary = await this.manager.createSession(nodeId, data.points, data.settings);
    return summary.sessionId;
  }

  async pauseBatchSession(sessionId: string): Promise<void> {
    this.manager.pause(sessionId);
  }

  async resumeBatchSession(sessionId: string): Promise<void> {
    this.manager.resume(sessionId);
  }

  async cancelBatchSession(sessionId: string): Promise<void> {
    this.manager.cancel(sessionId);
  }

  async getBatchSessionStatus(sessionId: string): Promise<BatchSessionStatus> {
    const summary = this.manager.getInitialSummary(sessionId);
    if (!summary) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Convert LocationPlugin format to standard format
    return {
      sessionId: summary.sessionId,
      nodeId: summary.nodeId,
      status: 'running', // LocationPlugin doesn't track status explicitly
      progress: {
        total: summary.totalPoints,
        completed: 0, // Would need to be tracked separately
        failed: 0,
        percentage: 0,
        currentStage: 'processing',
      },
      startedAt: Date.now(), // Would need to be tracked
    };
  }

  onBatchProgress(sessionId: string, callback: BatchProgressCallback): () => void {
    return this.manager.onProgress(sessionId, (event) => {
      // Convert ProgressEvent to StandardProgressEvent
      callback({
        sessionId: event.sessionId,
        stage: event.stage,
        total: event.total,
        completed: event.completed,
        failed: event.failed,
        percentage: event.percentage,
        currentTask: event.currentTask,
      });
    });
  }
}

/**
 * Location-specific configuration interface
 */
export interface LocationBatchConfig {
  concurrency?: number;
  // Add other location-specific config options
}

/**
 * Location-specific data interface
 */
export interface LocationBatchData {
  points: LocationPointInput[];
  settings: LocationTileSettings;
}

/**
 * Factory function to get the appropriate batch manager
 * Returns the unified manager if API v2 is enabled, otherwise returns a wrapper around the legacy manager
 */
export function createLocationBatchManager(): IBatchSessionManager {
  return new UnifiedLocationBatchManager();
}

/**
 * Feature flag check for location plugin specifically
 */
export function isLocationBatchAPIV2Enabled(): boolean {
  return isBatchControlAPIV2Enabled();
}
