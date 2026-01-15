import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { simplify as turfSimplify } from '@turf/turf';
import { geojson as geojsonApi } from 'flatgeobuf';

const EARTH_RADIUS = 6378137;
const MVT_EXTENT = 4096;

type LonLat = [number, number];
type Mercator = [number, number];
type GeometryWithCoords = Exclude<Geometry, { type: 'GeometryCollection' }>;

const metersPerPixel = (z: number): number => {
  return (2 * Math.PI * EARTH_RADIUS) / (MVT_EXTENT * Math.pow(2, z));
};

const lonLatToMercator = ([lon, lat]: LonLat): Mercator => {
  const x = (lon * Math.PI * EARTH_RADIUS) / 180;
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return [x, y];
};

const mercatorToLonLat = ([x, y]: Mercator): LonLat => {
  const lon = (x / EARTH_RADIUS) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * (180 / Math.PI);
  return [lon, lat];
};

const mapCoords = (coords: unknown, map: (coord: LonLat) => LonLat): unknown => {
  if (!Array.isArray(coords)) return coords;
  if (coords.length === 0) return coords;
  if (typeof coords[0] === 'number') {
    const [lon, lat] = coords as LonLat;
    return map([lon, lat]);
  }
  return (coords as unknown[]).map((child: unknown) => mapCoords(child, map));
};

const mapGeometry = (geometry: Geometry, map: (coord: LonLat) => LonLat): Geometry => {
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return {
      type: 'GeometryCollection',
      geometries: geometries.map((child: Geometry) => mapGeometry(child, map)),
    };
  }
  const coordsGeometry = geometry as GeometryWithCoords;
  return {
    ...coordsGeometry,
    coordinates: mapCoords(coordsGeometry.coordinates, map),
  } as Geometry;
};

export const snapGeometryToGrid = (geometry: Geometry, zTarget: number): Geometry => {
  const step = metersPerPixel(zTarget);
  const snapCoord = (coord: LonLat): LonLat => {
    const [mx, my] = lonLatToMercator(coord);
    const snappedX = Math.round(mx / step) * step;
    const snappedY = Math.round(my / step) * step;
    return mercatorToLonLat([snappedX, snappedY]);
  };
  return mapGeometry(geometry, snapCoord);
};

export const simplifyGeometryInMercator = (geometry: Geometry, toleranceMeters: number): Geometry => {
  const toMercator = (coord: LonLat): LonLat => {
    const [x, y] = lonLatToMercator(coord);
    return [x, y];
  };
  const toLonLat = (coord: LonLat): LonLat => {
    return mercatorToLonLat(coord);
  };
  const mercatorGeometry = mapGeometry(geometry, toMercator);
  const simplified = turfSimplify(mercatorGeometry, {
    tolerance: toleranceMeters,
    highQuality: false,
    mutate: false,
  }) as Geometry;
  return mapGeometry(simplified, toLonLat);
};

export const simplifyFeatureCollection = (
  collection: FeatureCollection,
  zTarget: number,
  toleranceK: number,
): FeatureCollection => {
  const tolerance = toleranceK * metersPerPixel(zTarget);
  const features = collection.features.map((feature: Feature) => {
    if (!feature.geometry) return feature;
    const snapped = snapGeometryToGrid(feature.geometry, zTarget);
    const simplified = simplifyGeometryInMercator(snapped, tolerance);
    return { ...feature, geometry: simplified };
  });
  return { ...collection, features };
};

export const buildBoundaryFeature = (
  feature: Feature,
  layerName: string,
  level?: number,
): Feature => {
  const geometry = feature.geometry;
  if (!geometry) {
    return { ...feature, properties: { ...feature.properties, layer: layerName, level } };
  }
  if (geometry.type === 'Polygon') {
    const rings = Array.isArray(geometry.coordinates)
      ? (geometry.coordinates as number[][][])
      : [];
    const geom = rings.length > 1
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

const normalizeFeatureCollection = async (decoded: unknown): Promise<FeatureCollection | null> => {
  if (!decoded || typeof decoded !== 'object') return null;
  const collection = decoded as FeatureCollection;
  if (collection.type === 'FeatureCollection') {
    const features = Array.isArray(collection.features) ? collection.features : [];
    return { ...collection, features };
  }
  if (typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: Feature[] = [];
    for await (const feature of decoded as AsyncIterable<Feature>) {
      features.push(feature);
    }
    return { type: 'FeatureCollection', features };
  }
  return null;
};

export const decodeTransformByBandCache = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  return normalizeFeatureCollection(decoded as unknown);
};

export const loadGeojsonVt = async () => {
  const mod = await import('geojson-vt');
  const candidate = mod as unknown as { default?: typeof import('geojson-vt') } & typeof import('geojson-vt');
  return candidate.default ?? candidate;
};

