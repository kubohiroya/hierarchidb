import type { RouteBatchSpec } from './types.js';
import { RouteSourceOrchestrator } from './RouteSourceOrchestrator.js';
import { mapEnrichTasks, mapMatrixTasks, mapRecomputeTasks } from './TaskMapper.js';
import { createRouteBatchManager, type NetworkPortLike } from '../services/createRouteBatchManager.js';

export interface RouteBatchManagerLike {
  startRouteBatchSession(nodeId: any, config: any, routes: Array<{
    startCoordinates?: [number, number];
    endCoordinates?: [number, number];
    method?: string
  }>): Promise<string>;
}

export class RouteBatchOrchestrationService {
  constructor(private source: RouteSourceOrchestrator, private net?: NetworkPortLike) {
  }

  async startFromSources(nodeId: any, spec: RouteBatchSpec, mgr: RouteBatchManagerLike | undefined, config: any): Promise<{
    jobId: string;
    count: number
  }> {
    const { odPairs } = await this.source.preview(spec);
    const routes = mapRecomputeTasks(odPairs, spec.defaults, { methodOptions: spec.defaults });
    const effectiveMgr = mgr ?? (createRouteBatchManager({ net: this.net }) as any as RouteBatchManagerLike);
    const jobId = await effectiveMgr.startRouteBatchSession(nodeId, config, routes);
    return { jobId, count: routes.length };
  }

  async startMatrix(nodeId: any, origins: RouteBatchSpec, destinations: RouteBatchSpec, mgr: RouteBatchManagerLike | undefined, config: any, methodOptions?: any): Promise<{
    jobId: string;
    count: number
  }> {
    const { odPairs: O } = await this.source.preview(origins);
    const { odPairs: D } = await this.source.preview(destinations);
    const routes = mapMatrixTasks(O, D, origins.defaults ?? destinations.defaults, methodOptions);
    const effectiveMgr = mgr ?? (createRouteBatchManager({ net: this.net }) as any as RouteBatchManagerLike);
    const jobId = await effectiveMgr.startRouteBatchSession(nodeId, config, routes);
    return { jobId, count: routes.length };
  }

  async startEnrich(nodeId: any, spec: RouteBatchSpec, mgr: RouteBatchManagerLike | undefined, config: any, options: any): Promise<{
    jobId: string;
    count: number
  }> {
    const { odPairs } = await this.source.preview(spec);
    const routes = mapEnrichTasks(odPairs, options, spec.defaults);
    const effectiveMgr = mgr ?? (createRouteBatchManager({ net: this.net }) as any as RouteBatchManagerLike);
    const jobId = await effectiveMgr.startRouteBatchSession(nodeId, config, routes);
    return { jobId, count: routes.length };
  }
}
