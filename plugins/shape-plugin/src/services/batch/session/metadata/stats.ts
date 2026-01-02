import type { FeatureCollection } from 'geojson';
import type { GeometryStatsSummary } from '../SessionTypes.js';

export function accumulateGeometryStats(target: GeometryStatsSummary, next: GeometryStatsSummary): GeometryStatsSummary {
  const vertexCount = target.vertexCount + next.vertexCount;
  const polygonCount = target.polygonCount + next.polygonCount;
  const area = target.area + next.area;
  let bbox = target.bbox;
  if (next.bbox) {
    if (!bbox) {
      bbox = next.bbox;
    } else {
      bbox = [
        Math.min(bbox[0], next.bbox[0]),
        Math.min(bbox[1], next.bbox[1]),
        Math.max(bbox[2], next.bbox[2]),
        Math.max(bbox[3], next.bbox[3]),
      ];
    }
  }
  return { vertexCount, polygonCount, area, bbox };
}

export async function summarizeFeatureCollectionStats(params: {
  buffer: ArrayBuffer;
  decodeFeatureCollection: (buffer: ArrayBuffer) => Promise<FeatureCollection | null>;
  extractGeometryStats: (feature: NonNullable<FeatureCollection['features'][number]>) => {
    vertexCount: number;
    polygonCount: number;
    bbox?: [number, number, number, number];
  };
}): Promise<GeometryStatsSummary> {
  const collection = await params.decodeFeatureCollection(params.buffer);
  if (!collection || collection.features.length === 0) {
    return { vertexCount: 0, polygonCount: 0, area: 0 };
  }

  let summary: GeometryStatsSummary = { vertexCount: 0, polygonCount: 0, area: 0 };
  for (const feature of collection.features) {
    if (!feature) continue;
    const stats = params.extractGeometryStats(feature);
    summary = accumulateGeometryStats(summary, {
      vertexCount: stats.vertexCount,
      polygonCount: stats.polygonCount,
      area: 0,
      bbox: stats.bbox,
    });
  }
  return summary;
}
