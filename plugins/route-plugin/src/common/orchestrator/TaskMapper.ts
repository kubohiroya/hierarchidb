import type { RouteBuildRouteCandidate } from '~/services/RouteBuildManager';
import type { OdPair, RouteBuildSpec } from './types.js';

export type RouteTaskInput = RouteBuildRouteCandidate;

export interface MapRecomputeOptions {
  chunkSize?: number;
  methodOptions?: RouteBuildRouteCandidate['methodOptions'];
}

export function mapRecomputeTasks(
  odPairs: OdPair[],
  defaults?: RouteBuildSpec['defaults'],
  opts?: MapRecomputeOptions
): RouteBuildRouteCandidate[] {
  return odPairs.map((o) => ({
    startCoordinates: [o.start.lon, o.start.lat],
    endCoordinates: [o.end.lon, o.end.lat],
    method: o.engine || defaults?.engine,
    methodOptions: opts?.methodOptions,
  }));
}

export function mapMatrixTasks(
  origins: OdPair[],
  destinations: OdPair[],
  defaults?: RouteBuildSpec['defaults'],
  methodOptions?: RouteBuildRouteCandidate['methodOptions']
): RouteBuildRouteCandidate[] {
  const out: RouteBuildRouteCandidate[] = [];
  for (const o of origins) {
    for (const d of destinations) {
      out.push({
        startCoordinates: [o.start.lon, o.start.lat],
        endCoordinates: [d.end.lon, d.end.lat],
        method: o.engine || d.engine || defaults?.engine,
        methodOptions,
      });
    }
  }
  return out;
}

export function mapEnrichTasks(
  odPairs: OdPair[],
  options?: RouteBuildRouteCandidate['methodOptions'],
  defaults?: RouteBuildSpec['defaults']
): RouteBuildRouteCandidate[] {
  return odPairs.map((o) => ({
    startCoordinates: [o.start.lon, o.start.lat],
    endCoordinates: [o.end.lon, o.end.lat],
    method: o.engine || defaults?.engine,
    methodOptions: options,
  }));
}
