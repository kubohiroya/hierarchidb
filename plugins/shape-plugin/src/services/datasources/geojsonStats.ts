import type { Feature, Geometry } from 'geojson';

const countVertices = (coords: unknown): number => {
  if (!Array.isArray(coords)) return 0;
  if (coords.length === 0) return 0;
  if (typeof coords[0] === 'number') return 1;
  return coords.reduce((sum: number, child: unknown) => sum + countVertices(child), 0);
};

const countVerticesFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countVerticesFromGeometry(child), 0);
  }
  return countVertices(geometry.coordinates);
};

const countPolygonsFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countPolygonsFromGeometry(child), 0);
  }
  if (geometry.type === 'Polygon') {
    return 1;
  }
  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;
  }
  return 0;
};

export const summarizeGeojsonFeatures = (
  features: Array<Feature<Geometry | null> | null | undefined>
): { featureCount: number; polygonCount: number; vertexCount: number } => {
  let featureCount = 0;
  let polygonCount = 0;
  let vertexCount = 0;
  for (const feature of features) {
    if (!feature) continue;
    featureCount += 1;
    polygonCount += countPolygonsFromGeometry(feature.geometry ?? null);
    vertexCount += countVerticesFromGeometry(feature.geometry ?? null);
  }
  return { featureCount, polygonCount, vertexCount };
};
