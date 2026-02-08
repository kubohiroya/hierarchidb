import type { Feature, FeatureCollection, GeoJSON, Geometry, LineString, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import area from '@turf/area';
import bbox from '@turf/bbox';
import bboxPolygon from '@turf/bbox-polygon';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import simplify from '@turf/simplify';
import { cleanCoords } from '@turf/clean-coords';
import { point } from '@turf/helpers';
import { bboxClip, booleanValid } from '@turf/turf';
import type { GeometryEngine } from './config.js';
import {
  geosArea,
  geosBbox,
  geosClip,
  geosContains,
  geosIsValid,
  geosSimplify,
} from './geos/index.js';

type Bbox = [number, number, number, number];

type ClipGeometry = Polygon | MultiPolygon | LineString | MultiLineString;
type ClipFeature = Feature<ClipGeometry>;
type PolygonLike = Polygon | MultiPolygon | Feature<Polygon | MultiPolygon>;

type SimplifyOptions = {
  tolerance: number;
  highQuality?: boolean;
  mutate?: boolean;
  preserveTopology?: boolean;
};

const toFeature = (geojson: GeoJSON): Feature => {
  if (geojson.type === 'Feature') return geojson as Feature;
  return { type: 'Feature', geometry: geojson as Geometry, properties: {} };
};

export const geometryArea = (geojson: GeoJSON, engine: GeometryEngine): number => {
  if (engine === 'geos') {
    return geosArea(geojson);
  }
  return area(geojson as Geometry | Feature | FeatureCollection);
};

export const geometryBbox = (geojson: GeoJSON, engine: GeometryEngine): Bbox | null => {
  if (engine === 'geos') {
    return geosBbox(geojson) ?? null;
  }
  const result = bbox(geojson as Geometry | Feature | FeatureCollection) as number[];
  if (result.length !== 4) return null;
  return [result[0] ?? 0, result[1] ?? 0, result[2] ?? 0, result[3] ?? 0];
};

export const geometryBboxPolygon = (bounds: Bbox): Polygon => {
  const polygon = bboxPolygon(bounds);
  return polygon.geometry as Polygon;
};

export const geometryBboxClip = (
  feature: ClipFeature,
  bounds: Bbox,
  engine: GeometryEngine,
): Feature | null => {
  if (engine === 'geos') {
    return geosClip(feature, bounds) as Feature | null;
  }
  return bboxClip(feature, bounds) as Feature | null;
};

export const geometrySimplify = <T extends GeoJSON>(
  geojson: T,
  engine: GeometryEngine,
  options: SimplifyOptions,
): T => {
  if (engine === 'geos') {
    return geosSimplify(geojson, options.tolerance, {
      preserveTopology: options.preserveTopology ?? true,
    }) as T;
  }
  return simplify(geojson as Feature | FeatureCollection, {
    tolerance: options.tolerance,
    highQuality: options.highQuality ?? false,
    mutate: options.mutate ?? false,
  }) as T;
};

export const geometryIsValid = (geojson: GeoJSON, engine: GeometryEngine): boolean => {
  if (engine === 'geos') {
    return geosIsValid(geojson);
  }
  const feature = toFeature(geojson);
  return booleanValid(feature);
};

export const geometryPointInPolygon = (
  coord: [number, number],
  polygon: PolygonLike,
  engine: GeometryEngine,
): boolean => {
  if (engine === 'geos') {
    const pt = { type: 'Point', coordinates: coord } as const;
    return geosContains(polygon, pt);
  }
  const pt = point(coord);
  return booleanPointInPolygon(pt, polygon as PolygonLike);
};

export const geometryCleanCoords = (geojson: GeoJSON): GeoJSON => {
  const feature = toFeature(geojson);
  const cleaned = cleanCoords(feature);
  return cleaned.geometry ?? geojson;
};
