import type { Feature, Geometry } from 'geojson';

export const buildBoundaryFeature = (
  feature: Feature,
  layerName: string,
  level?: number
): Feature => {
  const geometry = feature.geometry;
  if (!geometry) {
    return { ...feature, properties: { ...feature.properties, layer: layerName, level } };
  }
  if (geometry.type === 'Polygon') {
    const rings = Array.isArray(geometry.coordinates) ? (geometry.coordinates as number[][][]) : [];
    const geom =
      rings.length > 1
        ? { type: 'MultiLineString', coordinates: rings }
        : { type: 'LineString', coordinates: rings[0] ?? [] };
    return {
      type: 'Feature',
      geometry: geom as Geometry,
      properties: { ...feature.properties, layer: layerName, level },
    };
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = Array.isArray(geometry.coordinates)
      ? (geometry.coordinates as number[][][][])
      : [];
    const rings = polygons.flatMap((poly) => poly ?? []);
    const geom = { type: 'MultiLineString', coordinates: rings };
    return {
      type: 'Feature',
      geometry: geom as Geometry,
      properties: { ...feature.properties, layer: layerName, level },
    };
  }
  return {
    type: 'Feature',
    geometry,
    properties: { ...feature.properties, layer: layerName, level },
  };
};
