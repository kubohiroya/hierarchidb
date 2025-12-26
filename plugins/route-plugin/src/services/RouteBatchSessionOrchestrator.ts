import type { NodeId } from '@hierarchidb/common-types';
import { RouteBatchManager, type RouteBatchRouteInput, type RouteBatchManagerDeps } from './RouteBatchManager.js';
import type { RouteBatchSession } from './RouteBatchSession.js';
import { RouteDatabase } from './database/RouteDatabase.js';
import type { RouteBatchConfig } from '../common/types/BatchConfig.js';
import type {
  BatchProgressCallback,
  BatchProgressEvent,
  BatchSessionId,
  BatchSessionStatus,
  IBatchSessionManager,
  StageKey,
} from '@hierarchidb/common-api';
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
  private readonly db = new RouteDatabase();
  private readonly manager: RouteBatchManager;
  private readonly sessionNodeMap = new Map<BatchSessionId, NodeId>();

  constructor(deps?: RouteBatchManagerDeps) {
    super();
    const emitter = {
      emit: (update: { jobId: string; progress: number; phase: string; ts: number }) => {
        const event: BatchProgressEvent = {
          sessionId: update.jobId,
          nodeId: this.sessionNodeMap.get(update.jobId) ?? ('' as NodeId),
          stage: update.phase as StageKey,
          phase: update.progress >= 100 ? 'completed' : 'running',
          timestamp: update.ts,
          payload: {
            total: 100,
            completed: update.progress,
            failed: 0,
            currentTask: update.phase,
          },
        };
        this.emitProgress(update.jobId, event);
      },
    };
    this.manager = new RouteBatchManager({ ...deps, emitter });
  }

  async prepareSession(nodeId: NodeId, config: RouteBatchSessionConfig | RouteBatchConfig | undefined, data: RouteBatchInput): Promise<void> {
    const fullConfig = resolveRouteConfig(config);
    await this.db.savePendingSession({
      nodeId,
      config: fullConfig,
      routes: data.routes,
      storedAt: Date.now(),
    });
  }

  async startBatchSession(nodeId: NodeId): Promise<BatchSessionId> {
    const pending = await this.db.takePendingSession(nodeId);
    if (!pending) {
      throw new Error(`No pending route batch session for node ${nodeId}`);
    }
    const config = pending.config as RouteBatchConfig;
    const routes = (pending.routes as RouteBatchRouteInput[]) ?? [];
    if (routes.length === 0) {
      throw new Error('Route batch session requires at least one route');
    }

    const sessionId = await this.manager.startRouteBatchSession(nodeId, config, routes);
    this.sessionNodeMap.set(sessionId, nodeId);
    const session = this.manager.getSession(sessionId);
    if (session) {
      this.registerSession(session);
    }
    return sessionId;
  }

  async pauseBatchSession(sessionId: BatchSessionId): Promise<void> {
    if (this.sessions.has(sessionId)) {
      await super.pauseBatchSession(sessionId);
    }
    await this.manager.pauseRouteBatchSession(sessionId);
  }

  async resumeBatchSession(sessionId: BatchSessionId): Promise<void> {
    if (this.sessions.has(sessionId)) {
      await super.resumeBatchSession(sessionId);
    }
    await this.manager.resumeRouteBatchSession(sessionId);
  }

  async cancelBatchSession(sessionId: BatchSessionId): Promise<void> {
    if (this.sessions.has(sessionId)) {
      await super.cancelBatchSession(sessionId);
    }
    await this.manager.pauseRouteBatchSession(sessionId);
  }

  async getBatchSessionStatus(sessionId: BatchSessionId): Promise<BatchSessionStatus> {
    const [progress, cursor] = await Promise.all([
      this.manager.getRouteBatchProgress(sessionId),
      this.db.routeCursors.get(sessionId),
    ]);
    const total = progress.totalRoutes;
    const completed = progress.completedRoutes;
    const failed = progress.errors.length;
    const percentage = clampPercentage(progress.progress);
    const paused = cursor?.paused ?? false;
    const status: BatchSessionStatus['status'] = paused
      ? 'paused'
      : percentage >= 100
        ? 'completed'
        : failed > 0
          ? 'failed'
          : 'running';

    const lastError = progress.errors.length > 0 ? progress.errors[progress.errors.length - 1] : undefined;
    const nodeId = this.sessionNodeMap.get(sessionId) ?? ('' as NodeId);
    return {
      sessionId,
      nodeId,
      status,
      progress: {
        total,
        completed,
        failed,
        percentage,
        currentStage: progress.phase,
        currentTask: progress.phase,
      },
      startedAt: undefined,
      lastActivity: cursor?.updatedAt,
      error: lastError,
    };
  }

  onBatchProgress(sessionId: BatchSessionId, callback: BatchProgressCallback): () => void {
    return super.onBatchProgress(sessionId, callback);
  }

  protected async onSessionStatusChange(_session: RouteBatchSession): Promise<void> {
    const state = _session.getState();
    const cursor = await this.db.routeCursors.get(state.sessionId);
    if (cursor) {
      await this.db.routeCursors.update(state.sessionId, {
        updatedAt: Date.now(),
        paused: state.status === 'paused',
      });
    }
    if (state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') {
      this.sessions.delete(state.sessionId);
      this.sessionNodeMap.delete(state.sessionId);
      this.cleanupSessionTracking(state.sessionId);
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

export function createRouteBatchManager(deps?: RouteBatchManagerDeps): IBatchSessionManager {
  return new RouteBatchSessionOrchestrator(deps);
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}
