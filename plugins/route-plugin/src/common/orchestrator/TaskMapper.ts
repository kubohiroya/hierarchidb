import type { OdPair, RouteBatchSpec } from './types.js';
import type { RouteBuildRouteInput } from '../../services/RouteBuildManager.js';

export type RouteTaskInput = RouteBuildRouteInput;

export interface MapRecomputeOptions {
  chunkSize?: number;
  methodOptions?: RouteBuildRouteInput['methodOptions'];
}

export function mapRecomputeTasks(
  odPairs: OdPair[],
  defaults?: RouteBatchSpec['defaults'],
  opts?: MapRecomputeOptions,
): RouteBuildRouteInput[] {
  return odPairs.map((o) => ({
    startCoordinates: [o.start.lon, o.start.lat],
    endCoordinates: [o.end.lon, o.end.lat],
    method: (o.engine || defaults?.engine),
    methodOptions: opts?.methodOptions,
  }));
}

export function mapMatrixTasks(
  origins: OdPair[],
  destinations: OdPair[],
  defaults?: RouteBatchSpec['defaults'],
  methodOptions?: RouteBuildRouteInput['methodOptions'],
): RouteBuildRouteInput[] {
  const out: RouteBuildRouteInput[] = [];
  for (const o of origins) {
    for (const d of destinations) {
      out.push({
        startCoordinates: [o.start.lon, o.start.lat],
        endCoordinates: [d.end.lon, d.end.lat],
        method: (o.engine || d.engine || defaults?.engine),
        methodOptions,
      });
    }
  }
  return out;
}

export function mapEnrichTasks(
  odPairs: OdPair[],
  options?: RouteBuildRouteInput['methodOptions'],
  defaults?: RouteBatchSpec['defaults'],
): RouteBuildRouteInput[] {
  return odPairs.map((o) => ({
    startCoordinates: [o.start.lon, o.start.lat],
    endCoordinates: [o.end.lon, o.end.lat],
    method: (o.engine || defaults?.engine),
    methodOptions: options,
  }));
}
