import type { NodeId } from '@hierarchidb/core-types';
import { RouteBuildManager, type RouteBuildRouteInput, type RouteBuildManagerDeps } from './RouteBuildManager.js';
import type { RouteBuildSession } from './RouteBuildSession.js';
import type { RouteBatchConfig } from '@hierarchidb/route-store';
import type { BuildProgressCallback, BuildProgressEvent, BuildSessionStatus, StageKey } from '@hierarchidb/batch-api';
import { BaseBuildSessionManager } from '@hierarchidb/batch';

type RouteBuildConfig = RouteBatchConfig;

export interface RouteBuildSessionConfig {
  routeGeneration?: Partial<RouteBuildConfig['routeGeneration']>;
  locationResolution?: RouteBuildConfig['locationResolution'];
  validation?: RouteBuildConfig['validation'];
  laneCaps?: RouteBuildConfig['laneCaps'];
}
/** @deprecated Use RouteBuildSessionConfig. */
export type RouteBatchSessionConfig = RouteBuildSessionConfig;

export interface RouteBuildInput {
  routes: RouteBuildRouteInput[];
}
/** @deprecated Use RouteBuildInput. */
export type RouteBatchInput = RouteBuildInput;

export class RouteBuildSessionOrchestrator extends BaseBuildSessionManager {
  private readonly manager: RouteBuildManager;
  private readonly pendingSessions = new Map<NodeId, { config: RouteBuildConfig; routes: RouteBuildRouteInput[] }>();

  constructor(deps?: RouteBuildManagerDeps) {
    super();
    const emitter = {
      emit: (update: { jobId: string; progress: number; phase: string; ts: number }) => {
        const event: BuildProgressEvent = {
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
    this.manager = new RouteBuildManager({ ...deps, emitter });
  }

  async prepareSession(nodeId: NodeId, config: RouteBuildSessionConfig | RouteBuildConfig | undefined, data: RouteBuildInput): Promise<void> {
    const fullConfig = resolveRouteConfig(config);
    this.pendingSessions.set(nodeId, {
      config: fullConfig,
      routes: data.routes,
    });
  }

  async startBuildSession(nodeId: NodeId): Promise<BuildSessionStatus> {
    const pending = this.pendingSessions.get(nodeId);
    this.pendingSessions.delete(nodeId);
    if (!pending) {
      throw new Error(`No pending route build session for node ${nodeId}`);
    }
    const config = pending.config as RouteBuildConfig;
    const routes = (pending.routes as RouteBuildRouteInput[]) ?? [];
    if (routes.length === 0) {
      throw new Error('Route build session requires at least one route');
    }

    const sessionNodeId = await this.manager.startRouteBuildSession(nodeId, config, routes);
    const session = this.manager.getSession(sessionNodeId);
    if (session) {
      this.registerSession(session);
    }
    return this.getBuildSessionStatus(sessionNodeId);
  }
  /** @deprecated Use startBuildSession. */
  async startBatchSession(nodeId: NodeId): Promise<BuildSessionStatus> {
    return this.startBuildSession(nodeId);
  }

  async pauseBuildSession(nodeId: NodeId): Promise<void> {
    if (this.sessions.has(nodeId)) {
      await super.pauseBuildSession(nodeId);
    }
  }
  /** @deprecated Use pauseBuildSession. */
  async pauseBatchSession(nodeId: NodeId): Promise<void> {
    await this.pauseBuildSession(nodeId);
  }

  async resumeBuildSession(nodeId: NodeId): Promise<void> {
    if (this.sessions.has(nodeId)) {
      await super.resumeBuildSession(nodeId);
    }
  }
  /** @deprecated Use resumeBuildSession. */
  async resumeBatchSession(nodeId: NodeId): Promise<void> {
    await this.resumeBuildSession(nodeId);
  }

  onBuildProgress(nodeId: NodeId, callback: BuildProgressCallback): () => void {
    return super.onBuildProgress(nodeId, callback);
  }
  /** @deprecated Use onBuildProgress. */
  onBatchProgress(nodeId: NodeId, callback: BuildProgressCallback): () => void {
    return this.onBuildProgress(nodeId, callback);
  }

  protected async onSessionStatusChange(_session: RouteBuildSession): Promise<void> {
    const state = _session.getState();
    if (state.status === 'completed' || state.status === 'failed') {
      this.sessions.delete(state.nodeId);
      this.cleanupSessionTracking(state.nodeId);
    }
  }
}

function resolveRouteConfig(config?: RouteBuildSessionConfig | RouteBuildConfig): RouteBuildConfig {
  const defaults: RouteBuildConfig['routeGeneration'] = {
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

/** @deprecated Use RouteBuildSessionOrchestrator. */
export { RouteBuildSessionOrchestrator as RouteBatchSessionOrchestrator };
