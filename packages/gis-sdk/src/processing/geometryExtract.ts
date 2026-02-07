import simplify from '@turf/simplify';
import unkink from '@turf/unkink-polygon';
import { cleanCoords } from '@turf/clean-coords';
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties, MultiPolygon, Polygon } from 'geojson';

export interface ExtractOptions {
  tolerance: number;
  perFeature: boolean;
  quantize?: number;
}

const isPolygonFeature = (
  feature: Feature<Geometry, GeoJsonProperties>,
): feature is Feature<Polygon | MultiPolygon, GeoJsonProperties> => {
  const type = feature.geometry?.type;
  return type === 'Polygon' || type === 'MultiPolygon';
};

const extractFeature = (
  feature: Feature<Geometry, GeoJsonProperties>,
  tolerance: number,
): Feature<Geometry, GeoJsonProperties> => {
  if (!feature.geometry) return feature;
  const extracted = simplify(feature, { tolerance, highQuality: false, mutate: false });
  if (!isPolygonFeature(extracted)) return extracted;
  const unkinked = unkink(extracted);
  const polygons = unkinked.features
    .map((entry) => entry.geometry)
    .filter((geometry): geometry is Polygon => Boolean(geometry));
  if (polygons.length === 0) return extracted;
  const mergedGeometry: Polygon | MultiPolygon | undefined =
    polygons.length === 1
      ? polygons[0]
      : { type: 'MultiPolygon', coordinates: polygons.map((polygon) => polygon.coordinates) };
  if(! mergedGeometry){
    return { ...extracted };
  }
  return {
    ...extracted,
    geometry: mergedGeometry,
  };
};

const quantizeCoordinates = <T>(coords: T, quantize: number): T => {
  if (!Array.isArray(coords)) return coords;
  if (coords.length === 0) return coords;
  if (typeof coords[0] === 'number') {
    return (coords as number[]).map((value) => Math.round(value * quantize) / quantize) as unknown as T;
  }
  return (coords as unknown[]).map((child) => quantizeCoordinates(child, quantize)) as unknown as T;
};


const isSamePoint = (a?: number[], b?: number[]): boolean => {
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1];
};

const collapseConsecutivePoints = (points: number[][], keepClosed: boolean): number[][] => {
  const result: number[][] = [];
  for (const point of points) {
    if (!Array.isArray(point) || point.length < 2) {
      result.push(point);
      continue;
    }
    const prev = result[result.length - 1];
    if (!prev || !isSamePoint(prev, point)) {
      result.push(point);
    }
  }
  if (keepClosed && result.length > 0) {
    const first = result[0];
    const last = result[result.length - 1];
    if (!first || !last) return result;
    if (first[0] === undefined || first[1] === undefined) return result;
    if (last[0] === undefined || last[1] === undefined) return result;
    if (!isSamePoint(first, last)) {
      result.push([first[0], first[1]]);
    }
  }
  return result;
};

const quantizePoint = (coord: number[], quantize: number): number[] => {
  return coord.map((value) => Math.round(value * quantize) / quantize);
};

const quantizeRing = (ring: number[][], quantize: number): number[][] => {
  const wasClosed = ring.length > 1 && isSamePoint(ring[0], ring[ring.length - 1]);
  const quantized = ring.map((point) => quantizePoint(point, quantize));
  return collapseConsecutivePoints(quantized, wasClosed);
};

const hasTooFewRingPoints = (ring: number[][]): boolean => ring.length <= 2;

const prunePolygonRings = (rings: number[][][]): number[][][] | null => {
  if (!Array.isArray(rings) || rings.length === 0) return null;
  if (rings.some((ring) => !Array.isArray(ring) || hasTooFewRingPoints(ring))) {
    return null;
  }
  return rings;
};

const pruneQuantizedGeometry = (geometry: Geometry): Geometry | null => {
  if (geometry.type === 'GeometryCollection') {
    const geometries = (geometry.geometries ?? [])
      .map((child) => pruneQuantizedGeometry(child))
      .filter((child): child is Geometry => child !== null);
    if (geometries.length === 0) return null;
    return {
      ...geometry,
      geometries,
    };
  }
  if (geometry.type === 'Polygon') {
    const rings = Array.isArray(geometry.coordinates)
      ? (geometry.coordinates as number[][][])
      : [];
    const pruned = prunePolygonRings(rings);
    if (!pruned) return null;
    return {
      ...geometry,
      coordinates: pruned,
    } as Geometry;
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = Array.isArray(geometry.coordinates)
      ? (geometry.coordinates as number[][][][])
      : [];
    const prunedPolygons = polygons
      .map((polygon) => prunePolygonRings(polygon ?? []))
      .filter((polygon): polygon is number[][][] => polygon !== null);
    if (prunedPolygons.length === 0) return null;
    return {
      ...geometry,
      coordinates: prunedPolygons,
    } as Geometry;
  }
  return geometry;
};

const quantizeGeometryObject = (geometry: Geometry, quantize: number): Geometry => {
  if (geometry.type === 'GeometryCollection') {
    return {
      ...geometry,
      geometries: (geometry.geometries ?? []).map((child) => quantizeGeometryObject(child, quantize)),
    };
  }
  if (geometry.type === 'Polygon') {
    const rings = Array.isArray(geometry.coordinates)
      ? (geometry.coordinates as number[][][])
      : [];
    return {
      ...geometry,
      coordinates: rings.map((ring) => quantizeRing(ring ?? [], quantize)),
    } as Geometry;
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = Array.isArray(geometry.coordinates)
      ? (geometry.coordinates as number[][][][])
      : [];
    return {
      ...geometry,
      coordinates: polygons.map((polygon) => (polygon ?? []).map((ring) => quantizeRing(ring ?? [], quantize))),
    } as Geometry;
  }
  const coordinates = quantizeCoordinates(geometry.coordinates, quantize) as typeof geometry.coordinates;
  return {
    ...geometry,
    coordinates,
  } as Geometry;
};

const quantizeGeometry = (
  feature: Feature<Geometry, GeoJsonProperties>,
  quantize?: number,
): Feature<Geometry, GeoJsonProperties> | null => {
  if (!feature.geometry || !quantize || quantize <= 0) return feature;
  const quantized = {
    ...feature,
    geometry: quantizeGeometryObject(feature.geometry, quantize),
  };
  const prunedGeometry = pruneQuantizedGeometry(quantized.geometry);
  if (!prunedGeometry) {
    return null;
  }
  const prunedFeature = {
    ...quantized,
    geometry: prunedGeometry,
  };
  return cleanCoords(prunedFeature) as Feature<Geometry, GeoJsonProperties>;
};

export const extractGeoJson = (geojson: unknown, options: ExtractOptions): unknown => {
  if (!geojson || typeof geojson !== 'object') return geojson;

  const collection = geojson as FeatureCollection;
  if (collection.type === 'FeatureCollection' && Array.isArray(collection.features)) {
    if (!options.perFeature) return geojson;
    return {
      ...collection,
      features: collection.features
        .map((feature) => {
          const needsExtract = Number.isFinite(options.tolerance) && options.tolerance > 0;
          try {
            const extracted = needsExtract
              ? extractFeature(feature as Feature<Geometry>, options.tolerance)
              : (feature as Feature<Geometry>);
            return quantizeGeometry(extracted, options.quantize);
          } catch {
            return feature as Feature<Geometry>;
          }
        })
        .filter((feature): feature is Feature<Geometry, GeoJsonProperties> => Boolean(feature)),
    } satisfies FeatureCollection;
  }

  return geojson;
};
