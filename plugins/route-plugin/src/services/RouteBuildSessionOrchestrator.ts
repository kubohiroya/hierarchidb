import type { BuildSessionStatus } from '@hierarchidb/build-api';
import { CanonicalBuildSessionManager } from '@hierarchidb/build-runtime-services';
import type { NodeId } from '@hierarchidb/core-types';
import type { RouteBuildConfig } from '@hierarchidb/route-api';
import { DEFAULT_ROUTE_BUILD_CONFIG } from '~/common/config/buildConfig';
import {
  RouteBuildManager,
  type RouteBuildManagerDeps,
  type RouteBuildRouteInput,
} from './RouteBuildManager.js';

export interface RouteBuildSessionConfig {
  routeGeneration?: Partial<RouteBuildConfig['routeGeneration']>;
  locationResolution?: RouteBuildConfig['locationResolution'];
  validation?: RouteBuildConfig['validation'];
  laneCaps?: RouteBuildConfig['laneCaps'];
}

export interface RouteBuildInput {
  routes: RouteBuildRouteInput[];
}

export class RouteBuildSessionOrchestrator extends CanonicalBuildSessionManager {
  private readonly manager: RouteBuildManager;
  private readonly pendingSessions = new Map<NodeId, { config: RouteBuildConfig; routes: RouteBuildRouteInput[] }>();

  constructor(deps?: RouteBuildManagerDeps) {
    super();
    this.manager = new RouteBuildManager(deps, {
      onSessionReady: (session) => this.registerSession(session),
    });
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
    if (!this.manager.getSession(sessionNodeId)) {
      throw new Error(`Route build session not found after start: ${sessionNodeId}`);
    }
    return this.getBuildSessionStatus(sessionNodeId);
  }

}

function resolveRouteConfig(config?: RouteBuildSessionConfig | RouteBuildConfig): RouteBuildConfig {
  const defaults = DEFAULT_ROUTE_BUILD_CONFIG;
  const routeGenerationDefaults = DEFAULT_ROUTE_BUILD_CONFIG.routeGeneration;
  const routeGeneration: RouteBuildConfig['routeGeneration'] = {
    ...routeGenerationDefaults,
    ...config?.routeGeneration,
  };

  const routeConfig: RouteBuildConfig = {
    ...defaults,
    ...config,
    routeGeneration,
  };

  return {
    ...routeConfig,
    routeGeneration,
  };
}
