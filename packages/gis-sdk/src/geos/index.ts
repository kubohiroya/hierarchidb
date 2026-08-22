import area from '@turf/area';
import bbox from '@turf/bbox';
import bboxClip from '@turf/bbox-clip';
import booleanContains from '@turf/boolean-contains';
import booleanIntersects from '@turf/boolean-intersects';
import booleanValid from '@turf/boolean-valid';
import { cleanCoords } from '@turf/clean-coords';
import simplify from '@turf/simplify';
import unkink from '@turf/unkink-polygon';
import type { Feature, FeatureCollection, GeoJSON, Geometry, MultiPolygon, Polygon } from 'geojson';

export type GeosModule = {
  engine: 'turf';
};

export type GeosInitConfig = Record<string, never>;

const TURF_MODULE: GeosModule = { engine: 'turf' };

let initialized = false;

const isFeatureCollection = (value: GeoJSON): value is FeatureCollection =>
  value.type === 'FeatureCollection';

const isFeature = (value: GeoJSON): value is Feature => value.type === 'Feature';

const toFeature = (geojson: GeoJSON): Feature => {
  if (isFeature(geojson)) {
    return geojson;
  }
  return {
    type: 'Feature',
    geometry: geojson as Geometry,
    properties: {},
  };
};

export const initGeos = async (_config?: GeosInitConfig): Promise<GeosModule> => {
  initialized = true;
  return TURF_MODULE;
};

export const getGeosOrThrow = (): GeosModule => {
  if (!initialized) {
    throw new Error('geometry engine is not initialized; call initGeos() before use');
  }
  return TURF_MODULE;
};

export const geosArea = (geojson: GeoJSON): number => {
  return area(geojson as Geometry | Feature | FeatureCollection);
};

export const geosBbox = (geojson: GeoJSON): [number, number, number, number] | null => {
  const bounds = bbox(geojson as Geometry | Feature | FeatureCollection) as number[];
  if (bounds.length !== 4) return null;
  return [bounds[0] ?? 0, bounds[1] ?? 0, bounds[2] ?? 0, bounds[3] ?? 0];
};

export const geosIsValid = (geojson: GeoJSON): boolean => {
  return booleanValid(toFeature(geojson));
};

export const geosIsValidDetail = (
  geojson: GeoJSON
): {
  valid: boolean;
  reason?: string;
  location?: [number, number];
} => {
  const valid = geosIsValid(geojson);
  if (valid) {
    return { valid: true };
  }
  return {
    valid: false,
    reason: 'Invalid geometry detected by turf/boolean-valid',
  };
};

const simplifyFeature = (
  feature: Feature,
  tolerance: number,
  options?: { preserveTopology?: boolean }
): Feature => {
  void options;
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    return feature;
  }
  const simplified = simplify(feature, {
    tolerance,
    highQuality: false,
    mutate: false,
  });
  return simplified as Feature;
};

export const geosSimplify = (
  geojson: GeoJSON,
  tolerance: number,
  options?: { preserveTopology?: boolean }
): GeoJSON => {
  if (isFeatureCollection(geojson)) {
    return {
      ...geojson,
      features: geojson.features.map(
        (feature) => geosSimplify(feature as GeoJSON, tolerance, options) as Feature
      ),
    };
  }
  if (isFeature(geojson)) {
    return simplifyFeature(geojson, tolerance, options);
  }
  const simplified = simplifyFeature(toFeature(geojson), tolerance, options);
  return simplified.geometry ?? geojson;
};

const ensureValidFeatureGeometry = (feature: Feature): Feature => {
  const cleaned = cleanCoords(feature) as Feature;
  if (booleanValid(cleaned)) {
    return cleaned;
  }
  const geometry = cleaned.geometry;
  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
    return cleaned;
  }
  const pieces = unkink(cleaned as Feature<Polygon | MultiPolygon>)
    .features.map((entry) => entry.geometry)
    .filter((entry): entry is Polygon => Boolean(entry) && entry.type === 'Polygon');
  if (pieces.length === 0) {
    return cleaned;
  }
  if (pieces.length === 1) {
    const firstPiece = pieces[0];
    if (!firstPiece) {
      return cleaned;
    }
    return {
      ...cleaned,
      geometry: firstPiece,
    };
  }
  return {
    ...cleaned,
    geometry: {
      type: 'MultiPolygon',
      coordinates: pieces.map((entry) => entry.coordinates),
    },
  };
};

export const geosMakeValid = (geojson: GeoJSON): GeoJSON => {
  if (isFeatureCollection(geojson)) {
    return {
      ...geojson,
      features: geojson.features.map((feature) => geosMakeValid(feature as GeoJSON) as Feature),
    };
  }
  if (isFeature(geojson)) {
    return ensureValidFeatureGeometry(geojson);
  }
  const fixed = ensureValidFeatureGeometry(toFeature(geojson));
  return fixed.geometry ?? geojson;
};

export const geosIntersects = (left: GeoJSON, right: GeoJSON): boolean => {
  return booleanIntersects(toFeature(left), toFeature(right));
};

export const geosContains = (left: GeoJSON, right: GeoJSON): boolean => {
  return booleanContains(toFeature(left), toFeature(right));
};

export const geosClip = (
  feature: Feature,
  clipBbox: [number, number, number, number]
): Feature | null => {
  return bboxClip(feature as Feature<Polygon | MultiPolygon>, clipBbox) as Feature | null;
};
