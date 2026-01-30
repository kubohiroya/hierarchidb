import type { NodeId } from '@hierarchidb/common-types';
import { RouteBatchManager, type RouteBatchRouteInput, type RouteBatchManagerDeps } from './RouteBatchManager.js';
import type { RouteBatchSession } from './RouteBatchSession.js';
import type { RouteBatchConfig } from '@hierarchidb/route-store';
import type { BatchProgressCallback, BatchProgressEvent, BatchSessionStatus, StageKey } from '@hierarchidb/batch-api';
import { BaseBatchSessionManager } from '@hierarchidb/batch-runtime-services';

export interface RouteBatchSessionConfig {
  routeGeneration?: Partial<RouteBatchConfig['routeGeneration']>;
  locationResolution?: RouteBatchConfig['locationResolution'];
  validation?: RouteBatchConfig['validation'];
  laneCaps?: RouteBatchConfig['laneCaps'];
}

export interface RouteBatchInput {
  routes: RouteBatchRouteInput[];
}

export class RouteBatchSessionOrchestrator extends BaseBatchSessionManager {
  private readonly manager: RouteBatchManager;
  private readonly pendingSessions = new Map<NodeId, { config: RouteBatchConfig; routes: RouteBatchRouteInput[] }>();

  constructor(deps?: RouteBatchManagerDeps) {
    super();
    const emitter = {
      emit: (update: { jobId: string; progress: number; phase: string; ts: number }) => {
        const event: BatchProgressEvent = {
          nodeId: update.jobId as NodeId,
          stage: update.phase as StageKey,
          phase: update.progress >= 100 ? 'completed' : 'running',
          timestamp: update.ts,
          payload: {
            total: 100,
            completed: update.progress,
            failed: 0,
          },
        };
        this.emitProgress(update.jobId as NodeId, event);
      },
    };
    this.manager = new RouteBatchManager({ ...deps, emitter });
  }

  async prepareSession(nodeId: NodeId, config: RouteBatchSessionConfig | RouteBatchConfig | undefined, data: RouteBatchInput): Promise<void> {
    const fullConfig = resolveRouteConfig(config);
    this.pendingSessions.set(nodeId, {
      config: fullConfig,
      routes: data.routes,
    });
  }

  async startBatchSession(nodeId: NodeId): Promise<BatchSessionStatus> {
    const pending = this.pendingSessions.get(nodeId);
    this.pendingSessions.delete(nodeId);
    if (!pending) {
      throw new Error(`No pending route batch session for node ${nodeId}`);
    }
    const config = pending.config as RouteBatchConfig;
    const routes = (pending.routes as RouteBatchRouteInput[]) ?? [];
    if (routes.length === 0) {
      throw new Error('Route batch session requires at least one route');
    }

    const sessionNodeId = await this.manager.startRouteBatchSession(nodeId, config, routes);
    const session = this.manager.getSession(sessionNodeId);
    if (session) {
      this.registerSession(session);
    }
    return this.getBatchSessionStatus(sessionNodeId);
  }

  async pauseBatchSession(nodeId: NodeId): Promise<void> {
    if (this.sessions.has(nodeId)) {
      await super.pauseBatchSession(nodeId);
    }
  }

  async resumeBatchSession(nodeId: NodeId): Promise<void> {
    if (this.sessions.has(nodeId)) {
      await super.resumeBatchSession(nodeId);
    }
  }

  onBatchProgress(nodeId: NodeId, callback: BatchProgressCallback): () => void {
    return super.onBatchProgress(nodeId, callback);
  }

  protected async onSessionStatusChange(_session: RouteBatchSession): Promise<void> {
    const state = _session.getState();
    if (state.status === 'completed' || state.status === 'failed') {
      this.sessions.delete(state.nodeId);
      this.cleanupSessionTracking(state.nodeId);
    }
  }
}

function resolveRouteConfig(config?: RouteBatchSessionConfig | RouteBatchConfig): RouteBatchConfig {
  const defaults: RouteBatchConfig['routeGeneration'] = {
    method: 'direct',
    parallel: true,
    maxConcurrent: 4,
    retryOnFailure: false,
    maxRetries: 0,
  };
  return {
    routeGeneration: {
      ...defaults,
      ...config?.routeGeneration,
    },
    locationResolution: config?.locationResolution,
    validation: config?.validation,
    laneCaps: config?.laneCaps,
  };
}
