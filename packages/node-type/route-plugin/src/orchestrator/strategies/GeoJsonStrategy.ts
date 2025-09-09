import type { DataSourceSpec, DataSourceStrategy, OdPair, ParseTask, StrategyContext, TaskPlan } from '../types';

export class GeoJsonStrategy implements DataSourceStrategy {
  supports(spec: DataSourceSpec): boolean {
    return spec.type === 'geojson';
  }

  async plan(spec: DataSourceSpec, ctx: StrategyContext): Promise<TaskPlan> {
    const id = `${ctx.planId}:geojson:0`;
    if (spec.inline && !spec.url) return { fetch: [], parse: [{ kind: 'parse', source: 'geojson', payloadRef: id }] };
    if (!spec.url) throw new Error('GeoJSON strategy requires url or inline');
    return {
      fetch: [{ kind: 'fetch', url: spec.url }],
      parse: [{ kind: 'parse', source: 'geojson', payloadRef: spec.url }],
    };
  }

  async executeParse(task: ParseTask, blobs: Map<string, Blob>, defaults?: {
    engine?: string;
    mode?: string
  }): Promise<OdPair[]> {
    const blob = blobs.get(task.payloadRef);
    if (!blob) throw new Error('Missing payload');
    const text = await blob.text();
    const gj = JSON.parse(text);
    return parseGeoJson(gj, defaults);
  }
}

function parseGeoJson(gj: any, defaults?: { engine?: string; mode?: string }): OdPair[] {
  const feats: any[] = gj.type === 'FeatureCollection' ? gj.features : [gj];
  const out: OdPair[] = [];
  for (const f of feats) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'LineString' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
      const start = g.coordinates[0];
      const end = g.coordinates[g.coordinates.length - 1];
      out.push({
        start: { lon: start[0], lat: start[1] },
        end: { lon: end[0], lat: end[1] },
        mode: (f.properties?.mode || defaults?.mode) as any,
        engine: (f.properties?.engine || defaults?.engine) as any,
      });
    }
    if (g.type === 'Point' && f.properties?.end && Array.isArray(f.properties.end)) {
      const s = g.coordinates;
      const e = f.properties.end;
      out.push({
        start: { lon: s[0], lat: s[1] },
        end: { lon: e[0], lat: e[1] },
        mode: (f.properties?.mode || defaults?.mode) as any,
        engine: (f.properties?.engine || defaults?.engine) as any,
      });
    }
  }
  return out;
}

