import type { NodeId } from '@hierarchidb/core-types';
import type { RouteBatchConfig } from '@hierarchidb/route-store';
import type { RouteBatchSpec } from './types.js';
import type { RouteSourceOrchestrator } from './RouteSourceOrchestrator.js';
import { mapEnrichTasks, mapMatrixTasks, mapRecomputeTasks, type RouteTaskInput } from './TaskMapper.js';
import { RouteBatchSessionOrchestrator, type RouteBatchSessionConfig } from '../../services/RouteBatchSessionOrchestrator.js';
import type { RouteBatchManagerDeps } from '../../services/RouteBatchManager.js';

export type RouteBatchManagerLike = RouteBatchSessionOrchestrator;

export class RouteBatchOrchestrationService {
  constructor(private readonly source: RouteSourceOrchestrator, private readonly deps?: RouteBatchManagerDeps) {}

  async startFromSources(nodeId: NodeId, spec: RouteBatchSpec, mgr: RouteBatchManagerLike | undefined, config: RouteBatchConfig): Promise<{
    nodeId: NodeId;
    count: number
  }> {
    const { odPairs } = await this.source.preview(spec);
    const routes = mapRecomputeTasks(odPairs, spec.defaults, { methodOptions: spec.defaults });
    const effectiveMgr = mgr ?? new RouteBatchSessionOrchestrator(this.deps);
    await effectiveMgr.prepareSession(nodeId, toSessionConfig(config), { routes });
    await effectiveMgr.startBatchSession(nodeId);
    return { nodeId, count: routes.length };
  }

  async startMatrix(
    nodeId: NodeId,
    origins: RouteBatchSpec,
    destinations: RouteBatchSpec,
    mgr: RouteBatchManagerLike | undefined,
    config: RouteBatchConfig,
    methodOptions?: RouteTaskInput['methodOptions'],
  ): Promise<{
    nodeId: NodeId;
    count: number
  }> {
    const { odPairs: O } = await this.source.preview(origins);
    const { odPairs: D } = await this.source.preview(destinations);
    const routes = mapMatrixTasks(O, D, origins.defaults ?? destinations.defaults, methodOptions);
    const effectiveMgr = mgr ?? new RouteBatchSessionOrchestrator(this.deps);
    await effectiveMgr.prepareSession(nodeId, toSessionConfig(config), { routes });
    await effectiveMgr.startBatchSession(nodeId);
    return { nodeId, count: routes.length };
  }

  async startEnrich(
    nodeId: NodeId,
    spec: RouteBatchSpec,
    mgr: RouteBatchManagerLike | undefined,
    config: RouteBatchConfig,
    options: RouteTaskInput['methodOptions'],
  ): Promise<{
    nodeId: NodeId;
    count: number
  }> {
    const { odPairs } = await this.source.preview(spec);
    const routes = mapEnrichTasks(odPairs, options, spec.defaults);
    const effectiveMgr = mgr ?? new RouteBatchSessionOrchestrator(this.deps);
    await effectiveMgr.prepareSession(nodeId, toSessionConfig(config), { routes });
    await effectiveMgr.startBatchSession(nodeId);
    return { nodeId, count: routes.length };
  }
}

function toSessionConfig(config: RouteBatchConfig): RouteBatchSessionConfig {
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
