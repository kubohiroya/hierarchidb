import type { NodeId } from '@hierarchidb/core-types';
import type { RouteBuildConfig } from '@hierarchidb/route-store';
import type { RouteBuildSpec } from './types.js';
import type { RouteSourceOrchestrator } from './RouteSourceOrchestrator.js';
import { mapEnrichTasks, mapMatrixTasks, mapRecomputeTasks, type RouteTaskInput } from './TaskMapper.js';
import { RouteBuildSessionOrchestrator, type RouteBuildSessionConfig } from '~/services/RouteBuildSessionOrchestrator';
import type { RouteBuildManagerDeps } from '~/services/RouteBuildManager';

export type RouteBuildManagerLike = RouteBuildSessionOrchestrator;

export class RouteBuildOrchestrationService {
  constructor(private readonly source: RouteSourceOrchestrator, private readonly deps?: RouteBuildManagerDeps) {}

  async startFromSources(nodeId: NodeId, spec: RouteBuildSpec, mgr: RouteBuildManagerLike | undefined, config: RouteBuildConfig): Promise<{
    nodeId: NodeId;
    count: number
  }> {
    const { odPairs } = await this.source.preview(spec);
    const routes = mapRecomputeTasks(odPairs, spec.defaults, { methodOptions: spec.defaults });
    const effectiveMgr = mgr ?? new RouteBuildSessionOrchestrator(this.deps);
    await effectiveMgr.prepareLegacySession(nodeId, toSessionConfig(config), { routes });
    await effectiveMgr.startBuildSession(nodeId);
    return { nodeId, count: routes.length };
  }

  async startMatrix(
    nodeId: NodeId,
    origins: RouteBuildSpec,
    destinations: RouteBuildSpec,
    mgr: RouteBuildManagerLike | undefined,
    config: RouteBuildConfig,
    methodOptions?: RouteTaskInput['methodOptions'],
  ): Promise<{
    nodeId: NodeId;
    count: number
  }> {
    const { odPairs: O } = await this.source.preview(origins);
    const { odPairs: D } = await this.source.preview(destinations);
    const routes = mapMatrixTasks(O, D, origins.defaults ?? destinations.defaults, methodOptions);
    const effectiveMgr = mgr ?? new RouteBuildSessionOrchestrator(this.deps);
    await effectiveMgr.prepareLegacySession(nodeId, toSessionConfig(config), { routes });
    await effectiveMgr.startBuildSession(nodeId);
    return { nodeId, count: routes.length };
  }

  async startEnrich(
    nodeId: NodeId,
    spec: RouteBuildSpec,
    mgr: RouteBuildManagerLike | undefined,
    config: RouteBuildConfig,
    options: RouteTaskInput['methodOptions'],
  ): Promise<{
    nodeId: NodeId;
    count: number
  }> {
    const { odPairs } = await this.source.preview(spec);
    const routes = mapEnrichTasks(odPairs, options, spec.defaults);
    const effectiveMgr = mgr ?? new RouteBuildSessionOrchestrator(this.deps);
    await effectiveMgr.prepareLegacySession(nodeId, toSessionConfig(config), { routes });
    await effectiveMgr.startBuildSession(nodeId);
    return { nodeId, count: routes.length };
  }
}

function toSessionConfig(config: RouteBuildConfig): RouteBuildSessionConfig {
  return {
    routeGeneration: {
      method: config.routeGeneration.method,
      parallel: config.routeGeneration.parallel,
      maxConcurrent: config.routeGeneration.maxConcurrent,
      retryOnFailure: config.routeGeneration.retryOnFailure,
      maxRetries: config.routeGeneration.maxRetries,
    },
    locationResolution: config.locationResolution,
    validation: config.validation,
    laneCaps: config.laneCaps,
  };
}
