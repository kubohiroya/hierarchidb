import type { BuildSessionStatus } from '@hierarchidb/build-api';
import { CanonicalBuildSessionManager } from '@hierarchidb/build-runtime-services';
import type { NodeId } from '@hierarchidb/core-types';
import type { RouteBuildConfig, RouteBuildRouteInput } from '@hierarchidb/route-api';
import { RouteBuildManager, type RouteBuildManagerDeps } from './RouteBuildManager.js';
import { RouteBuildSession } from './RouteBuildSession.js';

export interface RouteBuildInput {
  routes: RouteBuildRouteInput[];
}

export class RouteBuildSessionOrchestrator extends CanonicalBuildSessionManager {
  private readonly manager: RouteBuildManager;
  private readonly pendingSessions = new Map<
    NodeId,
    { config: RouteBuildConfig; routes: RouteBuildRouteInput[] }
  >();

  constructor(deps?: RouteBuildManagerDeps) {
    super();
    this.manager = new RouteBuildManager(deps);
  }

  async prepareSession(
    nodeId: NodeId,
    config: RouteBuildConfig,
    data: RouteBuildInput
  ): Promise<void> {
    this.pendingSessions.set(nodeId, {
      config,
      routes: data.routes,
    });
  }

  async startBuildSession(nodeId: NodeId): Promise<BuildSessionStatus> {
    const existing = this.sessions.get(nodeId);
    if (existing) {
      if (!(existing instanceof RouteBuildSession)) {
        throw new Error(
          `Registered route session has an invalid implementation for ${String(nodeId)}`
        );
      }
      const state = existing.getState();
      if (state.status === 'running') {
        this.pendingSessions.delete(nodeId);
        return this.getBuildSessionStatus(nodeId);
      }
      if (state.status === 'idle' || state.status === 'paused') {
        this.pendingSessions.delete(nodeId);
        this.startSessionRun(existing);
        return this.getBuildSessionStatus(nodeId);
      }
      if (state.status !== 'completed' && state.status !== 'failed') {
        throw new Error(
          `Cannot start route build session for node ${String(nodeId)} from state ${state.status}`
        );
      }
    }

    const pending = this.pendingSessions.get(nodeId);
    this.pendingSessions.delete(nodeId);
    if (!pending) {
      throw new Error(`No pending route build session for node ${nodeId}`);
    }
    const { config, routes } = pending;
    if (routes.length === 0) {
      throw new Error('Route build session requires at least one route');
    }

    const session = await this.manager.createRouteBuildSession(nodeId, config, routes);
    this.registerSession(session);
    this.startSessionRun(session);
    return this.getBuildSessionStatus(nodeId);
  }

  private startSessionRun(session: RouteBuildSession): void {
    void session.start().catch((error: unknown) => {
      if (typeof console !== 'undefined') {
        console.warn('[RouteBuildSessionOrchestrator] Route build session failed', error);
      }
    });
  }
}
