import area from '@turf/area';
import bbox from '@turf/bbox';
import bboxClip from '@turf/bbox-clip';
import bboxPolygon from '@turf/bbox-polygon';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import booleanValid from '@turf/boolean-valid';
import { cleanCoords } from '@turf/clean-coords';
import { point } from '@turf/helpers';
import simplify from '@turf/simplify';
import unkink from '@turf/unkink-polygon';
import type {
  Feature,
  FeatureCollection,
  GeoJSON,
  Geometry,
  LineString,
  MultiLineString,
  MultiPolygon,
  Polygon,
} from 'geojson';
import type { GeometryEngine } from './configTypes.js';

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
  void engine;
  return area(geojson as Geometry | Feature | FeatureCollection);
};

export const geometryBbox = (geojson: GeoJSON, engine: GeometryEngine): Bbox | null => {
  void engine;
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
  engine: GeometryEngine
): Feature | null => {
  void engine;
  return bboxClip(feature, bounds) as Feature | null;
};

export const geometrySimplify = <T extends GeoJSON>(
  geojson: T,
  engine: GeometryEngine,
  options: SimplifyOptions
): T => {
  void engine;
  const simplifyOptions: Parameters<typeof simplify>[1] = {
    tolerance: options.tolerance,
    highQuality: options.highQuality ?? false,
    mutate: options.mutate ?? false,
  };
  if (options.preserveTopology !== undefined) {
    (
      simplifyOptions as Parameters<typeof simplify>[1] & { preserveTopology?: boolean }
    ).preserveTopology = options.preserveTopology;
  }
  return simplify(geojson as Feature | FeatureCollection, simplifyOptions) as T;
};

export const geometryIsValid = (geojson: GeoJSON, engine: GeometryEngine): boolean => {
  void engine;
  const feature = toFeature(geojson);
  return booleanValid(feature);
};

export const geometryPointInPolygon = (
  coord: [number, number],
  polygon: PolygonLike,
  engine: GeometryEngine
): boolean => {
  void engine;
  const pt = point(coord);
  return booleanPointInPolygon(pt, polygon as PolygonLike);
};

export const geometryCleanCoords = (geojson: GeoJSON): GeoJSON => {
  const feature = toFeature(geojson);
  const cleaned = cleanCoords(feature);
  return cleaned.geometry ?? geojson;
};

export const geometryUnkinkPolygons = (
  feature: Feature<Polygon | MultiPolygon>,
  engine: GeometryEngine
): Polygon[] => {
  void engine;
  const unkinked = unkink(feature);
  return unkinked.features
    .map((entry) => entry.geometry)
    .filter((geometry): geometry is Polygon => Boolean(geometry) && geometry.type === 'Polygon');
};
