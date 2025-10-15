import type { OdPair, RouteBatchSpec } from './types.js';
import type { RouteBatchRouteInput } from '../services/RouteBatchManager.js';

export type RouteTaskInput = RouteBatchRouteInput;

export interface MapRecomputeOptions {
  chunkSize?: number;
  methodOptions?: RouteBatchRouteInput['methodOptions'];
}

export function mapRecomputeTasks(
  odPairs: OdPair[],
  defaults?: RouteBatchSpec['defaults'],
  opts?: MapRecomputeOptions,
): RouteBatchRouteInput[] {
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
  methodOptions?: RouteBatchRouteInput['methodOptions'],
): RouteBatchRouteInput[] {
  const out: RouteBatchRouteInput[] = [];
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
  options?: RouteBatchRouteInput['methodOptions'],
  defaults?: RouteBatchSpec['defaults'],
): RouteBatchRouteInput[] {
  return odPairs.map((o) => ({
    startCoordinates: [o.start.lon, o.start.lat],
    endCoordinates: [o.end.lon, o.end.lat],
    method: (o.engine || defaults?.engine),
    methodOptions: options,
  }));
}
