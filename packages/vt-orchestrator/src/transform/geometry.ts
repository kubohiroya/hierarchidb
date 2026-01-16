import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon } from 'geojson';
import { area as turfArea, kinks as turfKinks, simplify as turfSimplify } from '@turf/turf';
import { cleanCoords } from '@turf/clean-coords';
import { geojson as geojsonApi } from 'flatgeobuf';
import type { RingFixConfig, SelfIntersectionConfig } from '@hierarchidb/gis-sdk';

const EARTH_RADIUS = 6378137;
const MVT_EXTENT = 4096;

type LonLat = [number, number];
type Mercator = [number, number];
type GeometryWithCoords = Exclude<Geometry, { type: 'GeometryCollection' }>;

const metersPerPixel = (z: number): number => {
  return (2 * Math.PI * EARTH_RADIUS) / (MVT_EXTENT * Math.pow(2, z));
};

const clampQuantizeRank = (quantize?: number): number => {
  if (!Number.isFinite(quantize)) return 1;
  const rounded = Math.round(quantize as number);
  return Math.min(5, Math.max(1, rounded));
};

const resolveQuantizeFactor = (quantize?: number): number => {
  const rank = clampQuantizeRank(quantize);
  return Math.pow(2, rank - 1);
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

const computeRingLengthMeters = (ring: number[][]): number => {
  if (ring.length < 2) return 0;
  let length = 0;
  for (let index = 1; index < ring.length; index += 1) {
    const prev = ring[index - 1];
    const curr = ring[index];
    if (!prev || !curr) continue;
    const [prevX, prevY] = lonLatToMercator([prev[0] ?? 0, prev[1] ?? 0]);
    const [currX, currY] = lonLatToMercator([curr[0] ?? 0, curr[1] ?? 0]);
    const dx = currX - prevX;
    const dy = currY - prevY;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    const [firstX, firstY] = lonLatToMercator([first[0] ?? 0, first[1] ?? 0]);
    const [lastX, lastY] = lonLatToMercator([last[0] ?? 0, last[1] ?? 0]);
    const dx = lastX - firstX;
    const dy = lastY - firstY;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
};

const computePolygonArea = (coords: number[][][]): number => {
  try {
    return Math.abs(turfArea({ type: 'Polygon', coordinates: coords } as Polygon));
  } catch {
    return 0;
  }
};

const computePolygonOutlineLength = (coords: number[][][]): number => {
  const outer = coords[0] ?? [];
  return computeRingLengthMeters(outer);
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


const cleanGeometry = (geometry: Geometry): Geometry => {
  const cleaned = cleanCoords({ type: 'Feature', geometry, properties: {} });
  return cleaned.geometry ?? geometry;
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

const snapGeometryToGridWithStep = (geometry: Geometry, step: number): Geometry => {
  const snapCoord = (coord: LonLat): LonLat => {
    const [mx, my] = lonLatToMercator(coord);
    const snappedX = Math.round(mx / step) * step;
    const snappedY = Math.round(my / step) * step;
    return mercatorToLonLat([snappedX, snappedY]);
  };
  return mapGeometry(geometry, snapCoord);
};

export const snapGeometryToGrid = (geometry: Geometry, zTarget: number, quantize?: number): Geometry => {
  const factor = resolveQuantizeFactor(quantize);
  return snapGeometryToGridWithStep(geometry, metersPerPixel(zTarget) * factor);
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

const removeConsecutiveDuplicatePoints = (ring: number[][]): number[][] => {
  if (ring.length === 0) return ring;
  const cleaned: number[][] = [];
  let prev: number[] | null = null;
  ring.forEach((point) => {
    if (!prev || point[0] !== prev[0] || point[1] !== prev[1]) {
      cleaned.push(point);
      prev = point;
    }
  });
  return cleaned;
};

const removeCollinearPoints = (ring: number[][]): number[][] => {
  if (ring.length <= 4) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return ring;
  const coords = first[0] === last[0] && first[1] === last[1]
    ? ring.slice(0, -1)
    : ring.slice();
  if (coords.length < 3) return ring;
  const result: number[][] = [];
  const epsilon = 1e-12;
  for (let i = 0; i < coords.length; i += 1) {
    const prev = coords[(i - 1 + coords.length) % coords.length];
    const curr = coords[i];
    const next = coords[(i + 1) % coords.length];
    if (!prev || !curr || !next) continue;
    const prevX = prev[0];
    const prevY = prev[1];
    const currX = curr[0];
    const currY = curr[1];
    const nextX = next[0];
    const nextY = next[1];
    if (
      prevX === undefined || prevY === undefined
      || currX === undefined || currY === undefined
      || nextX === undefined || nextY === undefined
    ) {
      continue;
    }
    const cross = (currX - prevX) * (nextY - prevY) - (currY - prevY) * (nextX - prevX);
    if (Math.abs(cross) > epsilon) {
      result.push(curr);
    }
  }
  if (result.length === 0) return ring;
  const firstResult = result[0];
  if (!firstResult) return ring;
  result.push(firstResult);
  return result;
};

const normalizeRing = (ring: number[][], config: RingFixConfig): number[][] => {
  let points = ring.slice();
  if (config.removeDuplicateConsecutivePoints) {
    points = removeConsecutiveDuplicatePoints(points);
  }
  if (config.removeCollinearPoints) {
    points = removeCollinearPoints(points);
  }
  if (points.length > 0) {
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) return points;
    if (first[0] !== last[0] || first[1] !== last[1]) {
      points = [...points, first];
    }
  }
  return points;
};

const computeRingArea = (ring: number[][]): number => {
  if (ring.length < 4) return 0;
  try {
    const polygon = { type: 'Polygon', coordinates: [ring] } as Polygon;
    return Math.abs(turfArea(polygon));
  } catch {
    return 0;
  }
};

const fixPolygonRings = (
  rings: number[][][],
  config: RingFixConfig,
  minRingArea: number,
): number[][][] | null => {
  const normalized = rings.map((ring) => normalizeRing(ring, config));
  const candidates = normalized
    .map((ring) => ({ ring, area: computeRingArea(ring), vertexCount: ring.length }))
    .filter((entry) => entry.vertexCount >= config.minRingVertices && entry.area >= minRingArea);
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => b.area - a.area);
  const outer = sorted[0]?.ring ?? candidates[0]?.ring;
  if (!outer) return null;
  const holes = candidates
    .filter((entry) => entry.ring !== outer)
    .map((entry) => entry.ring);
  return [outer, ...holes].filter(
    (ring): ring is number[][] => Array.isArray(ring) && ring.length >= config.minRingVertices,
  );
};

const applyRingFix = (
  geometry: Geometry,
  config: RingFixConfig,
  minRingArea: number,
): Geometry => {
  if (geometry.type === 'Polygon') {
    const rings = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const fixed = fixPolygonRings(rings as number[][][], config, minRingArea);
    return fixed ? { ...geometry, coordinates: fixed } : geometry;
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const fixedPolygons = polygons
      .map((rings) => fixPolygonRings(rings as number[][][], config, minRingArea))
      .filter((rings): rings is number[][][] => Boolean(rings));
    if (fixedPolygons.length === 0) {
      return geometry;
    }
    return { ...geometry, coordinates: fixedPolygons };
  }
  return geometry;
};

const applySelfIntersectionFix = (
  geometry: Geometry,
  config: SelfIntersectionConfig,
  minPolygonArea: number,
  zTarget: number,
  quantize?: number,
): Geometry => {
  const sanitizePolygon = (coords: number[][][]): number[][][] => (
    config.retainHoles ? coords : [coords[0] ?? []]
  );
  const applyToPolygon = (coords: number[][][]): { coords: number[][][]; area: number; hasKinks: boolean } => {
    const sanitized = sanitizePolygon(coords);
    const polygon = { type: 'Feature', geometry: { type: 'Polygon', coordinates: sanitized }, properties: {} } as const;
    const kinkPoints = turfKinks(polygon).features;
    const area = Math.abs(turfArea({ type: 'Polygon', coordinates: sanitized } as Polygon));
    return { coords: sanitized, area, hasKinks: kinkPoints.length > 0 };
  };

  const baseSnapTolerance = (metersPerPixel(zTarget) * resolveQuantizeFactor(quantize)) / 2;
  const snapStep = baseSnapTolerance * config.snapToleranceMultiplier;
  const geometryForFix = snapStep > 0
    ? snapGeometryToGridWithStep(geometry, snapStep)
    : geometry;

  const polygons = geometryForFix.type === 'Polygon'
    ? [geometryForFix.coordinates as number[][][]]
    : geometryForFix.type === 'MultiPolygon'
      ? geometryForFix.coordinates as number[][][][]
      : [];
  if (polygons.length === 0) return geometryForFix;

  const candidates = polygons
    .map((coords) => applyToPolygon(coords))
    .filter((entry) => entry.area >= minPolygonArea);
  if (candidates.length === 0) return geometryForFix;

  const hasKinks = candidates.some((entry) => entry.hasKinks);
  const shouldReduce = hasKinks
    || !config.retainHoles
    || (config.maxPolygons > 0 && candidates.length > config.maxPolygons);
  if (!shouldReduce && geometryForFix.type === 'MultiPolygon') {
    return geometryForFix;
  }

  const sorted = [...candidates].sort((a, b) => b.area - a.area);
  const limit = config.maxPolygons > 0 ? config.maxPolygons : sorted.length;
  const selected = config.strategy === 'keep_all'
    ? sorted.slice(0, limit)
    : sorted.slice(0, 1);
  const coords = selected.map((entry) => entry.coords);
  if (coords.length === 1) {
    return { type: 'Polygon', coordinates: coords[0] } as Polygon;
  }
  return { type: 'MultiPolygon', coordinates: coords } as MultiPolygon;
};

const applyPolygonAreaExclusion = (
  geometry: Geometry,
  coefficient: number,
  zTarget: number,
  quantize?: number,
): Geometry | null => {
  if (!Number.isFinite(coefficient)) {
    throw new Error('excludePolygonAreaCoefficient must be a finite number');
  }
  if (coefficient <= 0) return geometry;
  const gridSizeMeters = metersPerPixel(zTarget) * resolveQuantizeFactor(quantize);
  const shouldExclude = (coords: number[][][]): boolean => {
    const outlineLength = computePolygonOutlineLength(coords);
    if (outlineLength <= 0) return false;
    const area = computePolygonArea(coords);
    // Exclude tiny polygons relative to grid size and outline length.
    const threshold = (coefficient * gridSizeMeters * outlineLength) / 2;
    return area < threshold;
  };
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates as number[][][];
    return shouldExclude(coords) ? null : geometry;
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = geometry.coordinates as number[][][][];
    const filtered = polygons.filter((coords) => !shouldExclude(coords));
    return filtered.length > 0 ? { ...geometry, coordinates: filtered } : null;
  }
  return geometry;
};

export const simplifyFeatureCollection = (
  collection: FeatureCollection,
  zTarget: number,
  toleranceK: number,
  ringFixConfig: RingFixConfig | undefined,
  selfIntersectionConfig: SelfIntersectionConfig | undefined,
  quantize: number | undefined,
  excludePolygonAreaCoefficient: number,
): FeatureCollection => {
  const tolerance = toleranceK * metersPerPixel(zTarget);
  const ringFix = ringFixConfig ?? {
    minRingVertices: 4,
    minRingAreaMultiplier: 1,
    removeDuplicateConsecutivePoints: true,
    removeCollinearPoints: false,
  };
  const selfIntersection = selfIntersectionConfig ?? {
    strategy: 'keep_largest',
    minPolygonAreaMultiplier: 1,
    maxPolygons: 1,
    retainHoles: false,
    snapToleranceMultiplier: 1,
  };
  const baseArea = Math.pow(metersPerPixel(zTarget) * 2, 2);
  const minRingArea = baseArea * ringFix.minRingAreaMultiplier;
  const minPolygonArea = baseArea * selfIntersection.minPolygonAreaMultiplier;
  const features: Feature[] = [];
  for (const feature of collection.features) {
    if (!feature.geometry) {
      features.push(feature);
      continue;
    }
    const snapped = snapGeometryToGrid(feature.geometry, zTarget, quantize);
    const cleaned = cleanGeometry(snapped);
    const areaFiltered = applyPolygonAreaExclusion(cleaned, excludePolygonAreaCoefficient, zTarget, quantize);
    if (!areaFiltered) continue;
    const ringFixed = applyRingFix(areaFiltered, ringFix, minRingArea);
    const intersectionFixed = applySelfIntersectionFix(ringFixed, selfIntersection, minPolygonArea, zTarget, quantize);
    const simplified = simplifyGeometryInMercator(intersectionFixed, tolerance);
    features.push({ ...feature, geometry: simplified });
  }
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
