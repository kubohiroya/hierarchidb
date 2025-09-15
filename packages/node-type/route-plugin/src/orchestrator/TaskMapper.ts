import type { EngineMethod, OdPair, RouteBatchSpec } from './types';

export interface RouteTaskInput {
  startCoordinates?: [number, number];
  endCoordinates?: [number, number];
  method?: EngineMethod;
  methodOptions?: unknown;
}

export interface MapRecomputeOptions {
  chunkSize?: number;
  methodOptions?: unknown;
}

export function mapRecomputeTasks(odPairs: OdPair[], defaults?: RouteBatchSpec['defaults'], opts?: MapRecomputeOptions): RouteTaskInput[] {
  return odPairs.map((o) => ({
    startCoordinates: [o.start.lon, o.start.lat],
    endCoordinates: [o.end.lon, o.end.lat],
    method: (o.engine || defaults?.engine),
    methodOptions: opts?.methodOptions,
  }));
}

export function mapMatrixTasks(origins: OdPair[], destinations: OdPair[], defaults?: RouteBatchSpec['defaults'], methodOptions?: unknown): RouteTaskInput[] {
  const out: RouteTaskInput[] = [];
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

export function mapEnrichTasks(odPairs: OdPair[], options: unknown, defaults?: RouteBatchSpec['defaults']): RouteTaskInput[] {
  return odPairs.map((o) => ({
    startCoordinates: [o.start.lon, o.start.lat],
    endCoordinates: [o.end.lon, o.end.lat],
    method: (o.engine || defaults?.engine),
    methodOptions: options,
  }));
}
