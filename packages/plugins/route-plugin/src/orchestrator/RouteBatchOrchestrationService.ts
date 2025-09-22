import type { NodeId } from '@hierarchidb/common-type';
import type { RouteBatchConfig } from '../services/RouteBatchSession.js';
import type { RouteBatchSpec } from './types.js';
import { RouteSourceOrchestrator } from './RouteSourceOrchestrator.js';
import { mapEnrichTasks, mapMatrixTasks, mapRecomputeTasks, type RouteTaskInput } from './TaskMapper.js';
import { createRouteBatchManager, type NetworkPortLike } from '../services/createRouteBatchManager.js';

export interface RouteBatchManagerLike {
  startRouteBatchSession(nodeId: NodeId, config: RouteBatchConfig, routes: RouteTaskInput[]): Promise<string>;
}

export class RouteBatchOrchestrationService {
  constructor(private readonly source: RouteSourceOrchestrator, private readonly net?: NetworkPortLike) {}

  async startFromSources(nodeId: NodeId, spec: RouteBatchSpec, mgr: RouteBatchManagerLike | undefined, config: RouteBatchConfig): Promise<{
    jobId: string;
    count: number
  }> {
    const { odPairs } = await this.source.preview(spec);
    const routes = mapRecomputeTasks(odPairs, spec.defaults, { methodOptions: spec.defaults });
    const effectiveMgr = mgr ?? createRouteBatchManager({ net: this.net });
    const jobId = await effectiveMgr.startRouteBatchSession(nodeId, config, routes);
    return { jobId, count: routes.length };
  }

  async startMatrix(
    nodeId: NodeId,
    origins: RouteBatchSpec,
    destinations: RouteBatchSpec,
    mgr: RouteBatchManagerLike | undefined,
    config: RouteBatchConfig,
    methodOptions?: RouteTaskInput['methodOptions'],
  ): Promise<{
    jobId: string;
    count: number
  }> {
    const { odPairs: O } = await this.source.preview(origins);
    const { odPairs: D } = await this.source.preview(destinations);
    const routes = mapMatrixTasks(O, D, origins.defaults ?? destinations.defaults, methodOptions);
    const effectiveMgr = mgr ?? createRouteBatchManager({ net: this.net });
    const jobId = await effectiveMgr.startRouteBatchSession(nodeId, config, routes);
    return { jobId, count: routes.length };
  }

  async startEnrich(
    nodeId: NodeId,
    spec: RouteBatchSpec,
    mgr: RouteBatchManagerLike | undefined,
    config: RouteBatchConfig,
    options: RouteTaskInput['methodOptions'],
  ): Promise<{
    jobId: string;
    count: number
  }> {
    const { odPairs } = await this.source.preview(spec);
    const routes = mapEnrichTasks(odPairs, options, spec.defaults);
    const effectiveMgr = mgr ?? createRouteBatchManager({ net: this.net });
    const jobId = await effectiveMgr.startRouteBatchSession(nodeId, config, routes);
    return { jobId, count: routes.length };
  }
}
