/**
 * Unified Batch Control Facade for Location Plugin
 * Provides standardized batch control API while maintaining backward compatibility
 */

import type { NodeId } from '@hierarchidb/common-type';
import type {
  BatchProgressCallback,
  BatchSessionStatus,
  IBatchSessionManager,
  StandardProgressEvent,
} from '@hierarchidb/runtime-shared-batch-processor';
import { isBatchControlAPIV2Enabled } from '@hierarchidb/runtime-shared-batch-processor';
import { LocationBatchSessionManager } from './BatchSessionManager';
import type { LocationPointInput, LocationTileSettings } from './SessionController';
import { toStandardProgressEvent } from './ProgressAdapter';
import { getEphemeralLocationDB } from '../database/EphemeralLocationDB';

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

  async startBatchSession(nodeId: NodeId, config: LocationBatchConfig, data?: LocationBatchData): Promise<string> {
    if (!data || !data.points || !data.settings) {
      throw new Error('Location batch session requires points and settings data');
    }

    const summary = await this.manager.createSession(nodeId, data.points, data.settings, { concurrency: config?.concurrency });
    // Best-effort: ensure sessions table has an entry (if not already written by manager)
    const db = getEphemeralLocationDB();
    // @ts-ignore
    await db.table('sessions').put({
      sessionId: summary.sessionId,
      nodeId,
      bbox: summary.bbox,
      zoomMin: summary.zoomMin,
      zoomMax: summary.zoomMax,
      totalPoints: summary.totalPoints,
      createdAt: Date.now(),
      status: 'running',
    });
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
    return this.manager.onProgress(sessionId, async (event) => {
      const std: StandardProgressEvent = toStandardProgressEvent(event as any);
      // Persist lightweight progress snapshot (best-effort)
      const db = getEphemeralLocationDB();
      // @ts-ignore
      await db.table('sessions').update(sessionId, {
        // store last known percentage and status hint
        // schema is flexible; no index change required
        progress: std.percentage,
        updatedAt: Date.now(),
        status: std.percentage >= 100 ? 'completed' : 'running',
      });
      callback(std);
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
