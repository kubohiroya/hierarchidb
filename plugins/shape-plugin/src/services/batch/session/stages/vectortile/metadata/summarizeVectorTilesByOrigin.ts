import type { Feature } from 'geojson';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import { HDB_ORIGIN_KEY } from '../../../../utils/featureIds.js';
import type { GeometryStatsSummary } from '../../../SessionTypes.js';
import { accumulateGeometryStats } from '../../../metadata/stats.js';

export async function summarizeVectorTilesByOrigin(params: {
  listVectorTileRows: () => Promise<Array<{ z: number; x: number; y: number; data: ArrayBuffer }>>;
  extractGeometryStats: (feature: Feature) => {
    vertexCount: number;
    polygonCount: number;
    bbox?: [number, number, number, number];
    area: number;
  };
}): Promise<Map<string, GeometryStatsSummary>> {
  const statsByOrigin = new Map<string, GeometryStatsSummary>();
  const rows = await params.listVectorTileRows();

  for (const row of rows) {
    const tile = new VectorTile(new Pbf(new Uint8Array(row.data)));
    for (const layerName of Object.keys(tile.layers)) {
      const layer = tile.layers[layerName];
      if (!layer) continue;
      for (let index = 0; index < layer.length; index += 1) {
        const feature = layer.feature(index);
        const geojson = feature.toGeoJSON(row.x, row.y, row.z) as Feature;
        const properties = (geojson.properties ?? {}) as Record<string, unknown>;
        const rawOrigin = properties[HDB_ORIGIN_KEY] ?? properties.originKey;
        const originKey = typeof rawOrigin === 'string' ? rawOrigin : undefined;
        if (!originKey) continue;
        const stats = params.extractGeometryStats(geojson);
        const existing = statsByOrigin.get(originKey) ?? { vertexCount: 0, polygonCount: 0, area: 0 };
        statsByOrigin.set(originKey, accumulateGeometryStats(existing, {
          vertexCount: stats.vertexCount,
          polygonCount: stats.polygonCount,
          area: 0,
          bbox: stats.bbox,
        }));
      }
    }
  }

  return statsByOrigin;
}
