import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon } from 'geojson';
import { area as turfArea, booleanValid, kinks as turfKinks, simplify as turfSimplify, unkinkPolygon } from '@turf/turf';
import { cleanCoords } from '@turf/clean-coords';
import { geojson as geojsonApi } from 'flatgeobuf';
import type { PreSimplifyFilterConfig, RingFixConfig, SelfIntersectionConfig } from '@hierarchidb/gis-sdk';

const EARTH_RADIUS = 6378137;
const MVT_EXTENT = 4096;

type LonLat = [number, number];
type Mercator = [number, number];
type GeometryWithCoords = Exclude<Geometry, { type: 'GeometryCollection' }>;

type SimplifyProgress = {
  processed: number;
  total: number;
  featureIndex: number;
};

export type SimplifyIssueStage =
  | 'input'
  | 'snap'
  | 'clean'
  | 'ringFix'
  | 'areaExclusion'
  | 'selfIntersection'
  | 'validate';

export type SimplifyIssueKind =
  | 'nonFinite'
  | 'invalidGeometry'
  | 'invalidRing'
  | 'openRing'
  | 'degenerateRing'
  | 'duplicateVertex'
  | 'smallPolygon'
  | 'droppedPolygon'
  | 'unknown';

export type SimplifyIssue = {
  featureId: string;
  featureIndex: number;
  stage: SimplifyIssueStage;
  kind: SimplifyIssueKind;
  message: string;
};

type SimplifyOptions = {
  onProgress?: (progress: SimplifyProgress) => void | Promise<void>;
  onIssue?: (issue: SimplifyIssue) => void | Promise<void>;
  abortSignal?: AbortSignal;
  yieldEvery?: number;
};

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

const MAX_MERCATOR_LAT = 85.05112878;

const lonLatToMercator = ([lon, lat]: LonLat): Mercator => {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    throw new Error('lon/lat must be finite');
  }
  const clampedLat = Math.min(MAX_MERCATOR_LAT, Math.max(-MAX_MERCATOR_LAT, lat));
  const x = (lon * Math.PI * EARTH_RADIUS) / 180;
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (clampedLat * Math.PI) / 360));
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

const hasNonFiniteCoords = (coords: unknown): boolean => {
  if (!Array.isArray(coords)) return false;
  if (coords.length === 0) return false;
  if (typeof coords[0] === 'number') {
    const [lon, lat] = coords as number[];
    return !Number.isFinite(lon) || !Number.isFinite(lat);
  }
  return (coords as unknown[]).some((child: unknown) => hasNonFiniteCoords(child));
};

const hasNonFiniteGeometry = (geometry: Geometry): boolean => {
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.some((child) => hasNonFiniteGeometry(child));
  }
  return hasNonFiniteCoords((geometry as GeometryWithCoords).coordinates);
};

const countVertices = (coords: unknown): number => {
  if (!Array.isArray(coords)) return 0;
  if (coords.length === 0) return 0;
  if (typeof coords[0] === 'number') return 1;
  return coords.reduce((sum: number, child: unknown) => sum + countVertices(child), 0);
};

const countVerticesFromGeometry = (geometry: Geometry): number => {
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countVerticesFromGeometry(child), 0);
  }
  return countVertices((geometry as GeometryWithCoords).coordinates);
};

const isRingClosed = (ring: number[][]): boolean => {
  if (ring.length < 4) return false;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return false;
  return first[0] === last[0] && first[1] === last[1];
};

const hasOpenRings = (geometry: Geometry): boolean => {
  if (geometry.type === 'Polygon') {
    const rings = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    return rings.some((ring) => !isRingClosed(ring));
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    return polygons.some((rings) => rings.some((ring) => !isRingClosed(ring)));
  }
  return false;
};

const isGeometryValid = (geometry: Geometry): boolean => {
  if (geometry.type !== 'GeometryCollection') {
    const coords = (geometry as GeometryWithCoords).coordinates;
    if (hasNonFiniteCoords(coords)) return false;
    if (hasOpenRings(geometry)) return false;
  }
  try {
    const feature = { type: 'Feature', geometry, properties: {} } as Feature;
    return booleanValid(feature);
  } catch {
    return false;
  }
};


const cleanGeometry = (geometry: Geometry): Geometry => {
  try {
    const cleaned = cleanCoords({ type: 'Feature', geometry, properties: {} });
    return cleaned.geometry ?? geometry;
  } catch {
    return geometry;
  }
};

const validateSimplifiedGeometry = (
  geometry: Geometry,
  ringFix: RingFixConfig,
  minRingArea: number,
  dropInvalidHoles: boolean,
): Geometry => {
  const cleaned = cleanGeometry(geometry);
  const ringFixed = applyRingFix(cleaned, ringFix, minRingArea, dropInvalidHoles);
  if (!ringFixed) {
    throw new Error('simplify produced empty geometry');
  }
  if (!isGeometryValid(ringFixed)) {
    throw new Error('simplify produced invalid geometry');
  }
  return ringFixed;
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
  dropInvalidHoles: boolean,
): number[][][] | null => {
  const normalized = rings.map((ring) => normalizeRing(ring, config));
  const assessed = normalized.map((ring) => ({
    ring,
    area: computeRingArea(ring),
    vertexCount: ring.length,
    isClosed: isRingClosed(ring),
    hasNonFinite: hasNonFiniteCoords(ring),
  }));
  const valid = assessed.filter(
    (entry) => !entry.hasNonFinite
      && entry.isClosed
      && entry.vertexCount >= config.minRingVertices
      && entry.area >= minRingArea,
  );
  const fallback = assessed.filter(
    (entry) => !entry.hasNonFinite
      && entry.isClosed
      && entry.vertexCount >= config.minRingVertices,
  );
  if (valid.length === 0 && fallback.length === 0) return null;
  const sorted = [...(valid.length > 0 ? valid : fallback)].sort((a, b) => b.area - a.area);
  const outer = sorted[0]?.ring ?? valid[0]?.ring ?? fallback[0]?.ring;
  if (!outer) return null;
  const holes = (dropInvalidHoles ? valid : assessed)
    .filter((entry) => entry.ring !== outer)
    .filter((entry) => !dropInvalidHoles || (
      !entry.hasNonFinite
      && entry.isClosed
      && entry.vertexCount >= config.minRingVertices
      && entry.area >= minRingArea
    ))
    .map((entry) => entry.ring);
  return [outer, ...holes].filter(
    (ring): ring is number[][] => Array.isArray(ring) && ring.length >= config.minRingVertices,
  );
};

const applyRingFix = (
  geometry: Geometry,
  config: RingFixConfig,
  minRingArea: number,
  dropInvalidHoles: boolean,
): Geometry | null => {
  if (geometry.type === 'Polygon') {
    const rings = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const fixed = fixPolygonRings(rings as number[][][], config, minRingArea, dropInvalidHoles);
    return fixed ? { ...geometry, coordinates: fixed } : null;
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const fixedPolygons = polygons
      .map((rings) => fixPolygonRings(rings as number[][][], config, minRingArea, dropInvalidHoles))
      .filter((rings): rings is number[][][] => Boolean(rings));
    if (fixedPolygons.length === 0) {
      return null;
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
  quantize: number | undefined,
  options: { splitSelfIntersections: boolean; dropSmallPolygons: boolean; minRingVertices: number },
): Geometry | null => {
  const sanitizePolygon = (coords: number[][][]): number[][][] => (
    config.retainHoles ? coords : [coords[0] ?? []]
  );
  const splitPolygon = (coords: number[][][]): number[][][][] => {
    const polygon = { type: 'Feature', geometry: { type: 'Polygon', coordinates: coords }, properties: {} } as const;
    const kinkPoints = turfKinks(polygon).features;
    if (kinkPoints.length === 0) return [coords];
    try {
      const unkinked = unkinkPolygon(polygon);
      const pieces = unkinked.features
        .map((feature) => feature.geometry?.coordinates)
        .filter((piece): piece is number[][][] => Array.isArray(piece));
      return pieces.length > 0 ? pieces : [coords];
    } catch {
      return [coords];
    }
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

  const shouldSplit = options.splitSelfIntersections && !config.retainHoles;
  const candidates = polygons.flatMap((coords) => {
    const sanitized = sanitizePolygon(coords);
    const pieces = shouldSplit ? splitPolygon(sanitized) : [sanitized];
    return pieces.map((piece) => ({
      coords: piece,
      area: Math.abs(turfArea({ type: 'Polygon', coordinates: piece } as Polygon)),
      vertexCount: (piece[0] ?? []).length,
    }));
  });

  const filtered = options.dropSmallPolygons
    ? candidates.filter((entry) => entry.area >= minPolygonArea && entry.vertexCount >= options.minRingVertices)
    : candidates;
  const fallbackCandidates = candidates.filter((entry) => entry.vertexCount >= options.minRingVertices);
  const effective = filtered.length > 0
    ? filtered
    : fallbackCandidates.length > 0
      ? [fallbackCandidates.reduce((best, current) => (current.area > best.area ? current : best))]
      : [];
  if (effective.length === 0) return null;

  const sorted = [...effective].sort((a, b) => b.area - a.area);
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
    if (filtered.length > 0) {
      return { ...geometry, coordinates: filtered };
    }
    if (polygons.length === 0) return null;
    const largest = polygons.reduce((best, current) => (
      computePolygonArea(current) > computePolygonArea(best) ? current : best
    ));
    return { ...geometry, coordinates: [largest] };
  }
  return geometry;
};

const resolveFeatureId = (feature: Feature, featureIndex: number): string => {
  const rawId = feature.id ?? (feature.properties && 'id' in feature.properties ? feature.properties.id : undefined);
  if (rawId !== undefined && rawId !== null) return String(rawId);
  return `featureIndex:${featureIndex}`;
};

const recordIssue = async (
  options: SimplifyOptions | undefined,
  issue: SimplifyIssue,
): Promise<void> => {
  if (!options?.onIssue) return;
  await options.onIssue(issue);
};

export const simplifyFeatureCollection = async (
  collection: FeatureCollection,
  zTarget: number,
  toleranceK: number,
  ringFixConfig: RingFixConfig | undefined,
  selfIntersectionConfig: SelfIntersectionConfig | undefined,
  preSimplifyFilterConfig: PreSimplifyFilterConfig | undefined,
  quantize: number | undefined,
  excludePolygonAreaCoefficient: number,
  options?: SimplifyOptions,
): Promise<FeatureCollection> => {
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
  const preSimplify = preSimplifyFilterConfig ?? {
    excludeInvalidGeometry: true,
    dropInvalidHoles: true,
    splitSelfIntersections: true,
    dropSmallPolygons: true,
    maxVerticesPerFeature: 0,
  };
  const enforcePreSimplifyValidity = preSimplify.excludeInvalidGeometry && zTarget > 3;
  const maxVerticesPerFeature = preSimplify.maxVerticesPerFeature ?? 0;
  const yieldEvery = Math.max(1, Math.floor(options?.yieldEvery ?? 25));
  const baseArea = Math.pow(metersPerPixel(zTarget) * 2, 2);
  const minRingArea = baseArea * ringFix.minRingAreaMultiplier;
  const minPolygonArea = baseArea * selfIntersection.minPolygonAreaMultiplier;
  const features: Feature[] = [];
  let droppedNonFinite = 0;
  let droppedRingFix = 0;
  let droppedInvalidAfterRingFix = 0;
  let droppedArea = 0;
  let droppedIntersection = 0;
  let droppedInvalidAfterIntersection = 0;
  let oversizedCount = 0;
  const oversizedSamples: string[] = [];
  const total = collection.features.length;
  for (const [index, feature] of collection.features.entries()) {
    if (options?.abortSignal?.aborted) {
      throw new Error('task aborted');
    }
    if (!feature.geometry) {
      features.push(feature);
    } else {
      const featureId = resolveFeatureId(feature, index);
      if (maxVerticesPerFeature > 0) {
        const vertexCount = countVerticesFromGeometry(feature.geometry);
        if (vertexCount > maxVerticesPerFeature) {
          oversizedCount += 1;
          if (oversizedSamples.length < 3) {
            const rawId = feature.id ?? (feature.properties && 'id' in feature.properties
              ? feature.properties.id
              : undefined);
            const sampleId = rawId != null ? String(rawId) : `featureIndex:${index}`;
            oversizedSamples.push(sampleId);
          }
        }
      }
      if (hasNonFiniteGeometry(feature.geometry)) {
        droppedNonFinite += 1;
        await recordIssue(options, {
          featureId,
          featureIndex: index,
          stage: 'input',
          kind: 'nonFinite',
          message: 'non-finite coordinates detected',
        });
        continue;
      }
      let snapped: Geometry;
      try {
        snapped = snapGeometryToGrid(feature.geometry, zTarget, quantize);
      } catch {
        await recordIssue(options, {
          featureId,
          featureIndex: index,
          stage: 'snap',
          kind: 'invalidGeometry',
          message: 'snap to grid failed',
        });
        continue;
      }
      const cleaned = cleanGeometry(snapped);
      const ringFixed = applyRingFix(cleaned, ringFix, minRingArea, preSimplify.dropInvalidHoles);
      if (!ringFixed) {
        droppedRingFix += 1;
        await recordIssue(options, {
          featureId,
          featureIndex: index,
          stage: 'ringFix',
          kind: 'invalidRing',
          message: 'ring fix removed all rings',
        });
        continue;
      }
      if (enforcePreSimplifyValidity && !isGeometryValid(ringFixed)) {
        droppedInvalidAfterRingFix += 1;
        await recordIssue(options, {
          featureId,
          featureIndex: index,
          stage: 'ringFix',
          kind: 'invalidGeometry',
          message: 'geometry invalid after ring fix',
        });
        continue;
      }
      const areaFiltered = applyPolygonAreaExclusion(ringFixed, excludePolygonAreaCoefficient, zTarget, quantize);
      if (!areaFiltered) {
        droppedArea += 1;
        await recordIssue(options, {
          featureId,
          featureIndex: index,
          stage: 'areaExclusion',
          kind: 'smallPolygon',
          message: 'polygon excluded by area filter',
        });
        continue;
      }
      const intersectionFixed = applySelfIntersectionFix(
        areaFiltered,
        selfIntersection,
        minPolygonArea,
        zTarget,
        quantize,
        {
          splitSelfIntersections: preSimplify.splitSelfIntersections,
          dropSmallPolygons: preSimplify.dropSmallPolygons,
          minRingVertices: ringFix.minRingVertices,
        },
      );
      if (!intersectionFixed) {
        droppedIntersection += 1;
        await recordIssue(options, {
          featureId,
          featureIndex: index,
          stage: 'selfIntersection',
          kind: 'droppedPolygon',
          message: 'self-intersection fix removed polygons',
        });
        continue;
      }
      if (preSimplify.excludeInvalidGeometry && !isGeometryValid(intersectionFixed)) {
        droppedInvalidAfterIntersection += 1;
        await recordIssue(options, {
          featureId,
          featureIndex: index,
          stage: 'validate',
          kind: 'invalidGeometry',
          message: 'geometry invalid after self-intersection fix',
        });
        continue;
      }
      const simplified = simplifyGeometryInMercator(intersectionFixed, tolerance);
      const validated = validateSimplifiedGeometry(simplified, ringFix, minRingArea, preSimplify.dropInvalidHoles);
      features.push({ ...feature, geometry: validated });
    }
    const processed = index + 1;
    if (options?.onProgress && (processed % yieldEvery === 0 || processed === total)) {
      await options.onProgress({ processed, total, featureIndex: index });
    }
    if (processed % yieldEvery === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  if (oversizedCount > 0) {
    console.warn('[transform] oversized features observed during simplify', {
      oversizedCount,
      maxVerticesPerFeature,
      samples: oversizedSamples,
    });
  }
  if (features.length === 0 && total > 0) {
    console.warn('[transform] simplify removed all features', {
      zTarget,
      total,
      droppedNonFinite,
      droppedRingFix,
      droppedInvalidAfterRingFix,
      droppedArea,
      droppedIntersection,
      droppedInvalidAfterIntersection,
      oversizedCount,
    });
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
