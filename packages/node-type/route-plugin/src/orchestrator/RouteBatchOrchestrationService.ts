import type { RouteBatchSpec, OdPair } from './types';
import { RouteSourceOrchestrator } from './RouteSourceOrchestrator';

export interface RouteBatchManagerLike {
  startRouteBatchSession(nodeId: any, config: any, routes: Array<{ startCoordinates?: [number,number]; endCoordinates?: [number,number]; method?: string }>): Promise<string>;
}

export class RouteBatchOrchestrationService {
  constructor(private source: RouteSourceOrchestrator) {}
  async startFromSources(nodeId: any, spec: RouteBatchSpec, mgr: RouteBatchManagerLike, config: any): Promise<{ jobId: string; count: number }> {
    const { odPairs } = await this.source.preview(spec);
    const routes = mapOdToRoutes(odPairs);
    const jobId = await mgr.startRouteBatchSession(nodeId, config, routes);
    return { jobId, count: routes.length };
  }
}

function mapOdToRoutes(ods: OdPair[]): Array<{ startCoordinates: [number,number]; endCoordinates: [number,number]; method?: string }> {
  return ods.map((o) => ({ startCoordinates: [o.start.lon, o.start.lat], endCoordinates: [o.end.lon, o.end.lat], method: o.engine }));
}

