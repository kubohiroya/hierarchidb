import type { DataSourceSpec, DataSourceStrategy, OdPair, ParseTask, RouteBuildSpec, StrategyContext, TaskPlan } from '~/common/orchestrator/types';
import { normalizeEngine, normalizeMode, toCoordinatePair } from './strategy-utils.js';

export class GeoJsonStrategy implements DataSourceStrategy {
  supports(spec: DataSourceSpec): boolean {
    return spec.type === 'geojson';
  }

  async plan(spec: DataSourceSpec, ctx: StrategyContext): Promise<TaskPlan> {
    const id = `${ctx.planId}:geojson:0`;
    if (spec.inline && !spec.url) return { source: [], parse: [{ kind: 'parse', source: 'geojson', payloadRef: id }] };
    if (!spec.url) throw new Error('GeoJSON strategy requires url or inline');
    return {
      source: [{ kind: 'source', url: spec.url }],
      parse: [{ kind: 'parse', source: 'geojson', payloadRef: spec.url }],
    };
  }

  async executeParse(task: ParseTask, blobs: Map<string, Blob>, defaults?: RouteBuildSpec['defaults']): Promise<OdPair[]> {
    const blob = blobs.get(task.payloadRef);
    if (!blob) throw new Error('Missing payload');
    const text = await blob.text();
    const gj = JSON.parse(text);
    return parseGeoJson(gj, defaults);
  }
}

interface GeoJsonFeature {
  geometry?: { type?: string; coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
}

function parseGeoJson(source: unknown, defaults?: RouteBuildSpec['defaults']): OdPair[] {
  const features = toFeatureList(source);
  const out: OdPair[] = [];
  for (const feature of features) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    const mode = normalizeMode(properties.mode, defaults?.mode);
    const engine = normalizeEngine(properties.engine, defaults?.engine);

    if (geometry.type === 'LineString') {
      const coords = Array.isArray(geometry.coordinates) ? geometry.coordinates : undefined;
      const start = coords ? toCoordinatePair(coords[0]) : undefined;
      const end = coords ? toCoordinatePair(coords[coords.length - 1]) : undefined;
      if (start && end) {
        const od: OdPair = { start: { lon: start[0], lat: start[1] }, end: { lon: end[0], lat: end[1] } };
        if (mode) od.mode = mode;
        if (engine) od.engine = engine;
        out.push(od);
      }
      continue;
    }

    const endCandidate = properties.end;
    if (geometry.type === 'Point' && Array.isArray(endCandidate)) {
      const start = toCoordinatePair(geometry.coordinates);
      const end = toCoordinatePair(endCandidate);
      if (start && end) {
        const od: OdPair = { start: { lon: start[0], lat: start[1] }, end: { lon: end[0], lat: end[1] } };
        if (mode) od.mode = mode;
        if (engine) od.engine = engine;
        out.push(od);
      }
    }
  }
  return out;
}

function toFeatureList(source: unknown): GeoJsonFeature[] {
  if (typeof source !== 'object' || source === null) return [];
  const record = source as Record<string, unknown>;
  if (record.type === 'FeatureCollection' && Array.isArray(record.features)) {
    return record.features as GeoJsonFeature[];
  }
  return [record as GeoJsonFeature];
}
