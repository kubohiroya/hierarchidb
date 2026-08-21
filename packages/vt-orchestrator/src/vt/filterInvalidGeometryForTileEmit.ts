import {
  type GeometryEngine,
  geometryArea,
  type TileEmitInvalidGeometryFilterConfig,
} from '@hierarchidb/gis-sdk';
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  GeometryCollection,
  MultiPolygon,
  Polygon,
  Position,
} from 'geojson';

const EARTH_RADIUS_METERS = 6371008.8;

export const TILE_EMIT_INVALID_GEOMETRY_FILTER_THRESHOLDS = {
  minAreaMeters2: 1e-8,
  minLineLengthMeters: 1e-6,
  maxEdgeToBBoxDiagonalRatio: 8,
  minTriangleAreaToBBoxRatio: 0.015,
} as const;

export type TileEmitInvalidGeometryCheck = keyof TileEmitInvalidGeometryFilterConfig;

export type TileEmitInvalidGeometryFilterProgress = {
  check: TileEmitInvalidGeometryCheck;
  polygonIndex: number;
  polygonTotal: number;
};

export type TileEmitInvalidGeometryFilterMetrics = {
  invalidPolygonFilteredCount: number;
  invalidPolygonCheckedCount: number;
  invalidPolygonFilteredRate: number;
  affectedFeatureCount: number;
  featureErrorCountTotal: number;
  invalidPolygonFilteredByCheck: Record<TileEmitInvalidGeometryCheck, number>;
};

export type FilteredTileEmitFeature = {
  sourceFeature: Feature<Geometry>;
  feature: Feature<Geometry>;
};

export type TileEmitInvalidGeometryFilterResult = {
  collection: FeatureCollection;
  filteredFeatures: FilteredTileEmitFeature[];
  metrics: TileEmitInvalidGeometryFilterMetrics;
};

type FilterContext = {
  config: TileEmitInvalidGeometryFilterConfig;
  geometryEngine: GeometryEngine;
  enabledChecks: TileEmitInvalidGeometryCheck[];
  polygonTotal: number;
  polygonIndex: number;
  filteredByCheck: Record<TileEmitInvalidGeometryCheck, number>;
  onProgress?: (progress: TileEmitInvalidGeometryFilterProgress) => Promise<void> | void;
};

const CHECK_ORDER: readonly TileEmitInvalidGeometryCheck[] = [
  'area',
  'lineLength',
  'maxEdgeLength',
  'selfIntersection',
  'triangleRingRatio',
];

const createCheckCounter = (): Record<TileEmitInvalidGeometryCheck, number> => ({
  area: 0,
  lineLength: 0,
  maxEdgeLength: 0,
  selfIntersection: 0,
  triangleRingRatio: 0,
});

const assertRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[tileEmit] ${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

export const assertTileEmitInvalidGeometryFilterConfig = (
  value: unknown
): TileEmitInvalidGeometryFilterConfig => {
  const record = assertRecord(value, 'tileEmitConfig.invalidGeometryFilter');
  for (const key of CHECK_ORDER) {
    if (typeof record[key] !== 'boolean') {
      throw new Error(`[tileEmit] tileEmitConfig.invalidGeometryFilter.${key} must be boolean`);
    }
  }
  return record as TileEmitInvalidGeometryFilterConfig;
};

const assertArray = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error(`[tileEmit] ${label} must be an array`);
  }
  return value;
};

const assertPosition = (value: unknown, label: string): Position => {
  const position = assertArray(value, label);
  if (position.length < 2) {
    throw new Error(`[tileEmit] ${label} must contain longitude and latitude`);
  }
  for (let index = 0; index < position.length; index += 1) {
    const coordinate = position[index];
    if (typeof coordinate !== 'number' || !Number.isFinite(coordinate)) {
      throw new Error(`[tileEmit] ${label}[${index}] must be a finite number`);
    }
  }
  const longitude = position[0];
  const latitude = position[1];
  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
    throw new Error(`[tileEmit] ${label} longitude must be within -180..180`);
  }
  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
    throw new Error(`[tileEmit] ${label} latitude must be within -90..90`);
  }
  return position as Position;
};

const positionsEqual = (left: Position, right: Position): boolean =>
  left[0] === right[0] && left[1] === right[1];

const assertLineStringCoordinates = (value: unknown, label: string): Position[] => {
  const coordinates = assertArray(value, label).map((position, index) =>
    assertPosition(position, `${label}[${index}]`)
  );
  if (coordinates.length < 2) {
    throw new Error(`[tileEmit] ${label} must contain at least two positions`);
  }
  return coordinates;
};

const assertLinearRing = (value: unknown, label: string): Position[] => {
  const ring = assertLineStringCoordinates(value, label);
  if (ring.length < 4) {
    throw new Error(`[tileEmit] ${label} must contain at least four positions`);
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last || !positionsEqual(first, last)) {
    throw new Error(`[tileEmit] ${label} must be closed`);
  }
  return ring;
};

const assertPolygonCoordinates = (value: unknown, label: string): Position[][] => {
  const coordinates = assertArray(value, label);
  if (coordinates.length === 0) {
    throw new Error(`[tileEmit] ${label} must contain at least one linear ring`);
  }
  return coordinates.map((ring, index) => assertLinearRing(ring, `${label}[${index}]`));
};

const validateGeometry = (value: unknown, label: string): void => {
  const geometry = assertRecord(value, label) as unknown as Geometry;
  switch (geometry.type) {
    case 'Point':
      assertPosition(geometry.coordinates, `${label}.coordinates`);
      return;
    case 'MultiPoint': {
      const coordinates = assertArray(geometry.coordinates, `${label}.coordinates`);
      if (coordinates.length === 0)
        throw new Error(`[tileEmit] ${label}.coordinates must not be empty`);
      coordinates.forEach((position, index) => {
        assertPosition(position, `${label}.coordinates[${index}]`);
      });
      return;
    }
    case 'LineString':
      assertLineStringCoordinates(geometry.coordinates, `${label}.coordinates`);
      return;
    case 'MultiLineString': {
      const coordinates = assertArray(geometry.coordinates, `${label}.coordinates`);
      if (coordinates.length === 0)
        throw new Error(`[tileEmit] ${label}.coordinates must not be empty`);
      coordinates.forEach((line, index) => {
        assertLineStringCoordinates(line, `${label}.coordinates[${index}]`);
      });
      return;
    }
    case 'Polygon':
      assertPolygonCoordinates(geometry.coordinates, `${label}.coordinates`);
      return;
    case 'MultiPolygon': {
      const coordinates = assertArray(geometry.coordinates, `${label}.coordinates`);
      if (coordinates.length === 0)
        throw new Error(`[tileEmit] ${label}.coordinates must not be empty`);
      coordinates.forEach((polygon, index) => {
        assertPolygonCoordinates(polygon, `${label}.coordinates[${index}]`);
      });
      return;
    }
    case 'GeometryCollection':
      if (!Array.isArray(geometry.geometries) || geometry.geometries.length === 0) {
        throw new Error(`[tileEmit] ${label}.geometries must not be empty`);
      }
      geometry.geometries.forEach((child, index) => {
        validateGeometry(child, `${label}.geometries[${index}]`);
      });
      return;
    default:
      throw new Error(`[tileEmit] ${label}.type is unsupported`);
  }
};

const countPolygons = (geometry: Geometry): number => {
  if (geometry.type === 'Polygon') return 1;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.length;
  if (geometry.type === 'GeometryCollection') {
    return geometry.geometries.reduce((total, child) => total + countPolygons(child), 0);
  }
  return 0;
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const distanceMeters = (left: Position, right: Position): number => {
  const leftLongitude = left[0];
  const leftLatitude = left[1];
  const rightLongitude = right[0];
  const rightLatitude = right[1];
  if (
    typeof leftLongitude !== 'number' ||
    typeof leftLatitude !== 'number' ||
    typeof rightLongitude !== 'number' ||
    typeof rightLatitude !== 'number'
  ) {
    throw new Error('[tileEmit] validated position lost its numeric coordinates');
  }
  const latitudeDelta = toRadians(rightLatitude - leftLatitude);
  const longitudeDelta = toRadians(rightLongitude - leftLongitude);
  const leftLatitudeRadians = toRadians(leftLatitude);
  const rightLatitudeRadians = toRadians(rightLatitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitudeRadians) *
      Math.cos(rightLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;
  const distance = 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
  if (!Number.isFinite(distance)) {
    throw new Error('[tileEmit] geodesic distance calculation returned a non-finite value');
  }
  return distance;
};

const computeRingLengthMeters = (ring: Position[]): number => {
  let length = 0;
  for (let index = 1; index < ring.length; index += 1) {
    const previous = ring[index - 1];
    const current = ring[index];
    if (!previous || !current) throw new Error('[tileEmit] validated ring lost a position');
    length += distanceMeters(previous, current);
  }
  return length;
};

const computeRingMaxEdgeLengthMeters = (ring: Position[]): number => {
  let maximum = 0;
  for (let index = 1; index < ring.length; index += 1) {
    const previous = ring[index - 1];
    const current = ring[index];
    if (!previous || !current) throw new Error('[tileEmit] validated ring lost a position');
    maximum = Math.max(maximum, distanceMeters(previous, current));
  }
  return maximum;
};

const computeRingBoundsDiagonalMeters = (ring: Position[]): number => {
  let minLongitude = Number.POSITIVE_INFINITY;
  let minLatitude = Number.POSITIVE_INFINITY;
  let maxLongitude = Number.NEGATIVE_INFINITY;
  let maxLatitude = Number.NEGATIVE_INFINITY;
  for (const position of ring) {
    const longitude = position[0];
    const latitude = position[1];
    if (typeof longitude !== 'number' || typeof latitude !== 'number') {
      throw new Error('[tileEmit] validated ring lost its numeric coordinates');
    }
    minLongitude = Math.min(minLongitude, longitude);
    minLatitude = Math.min(minLatitude, latitude);
    maxLongitude = Math.max(maxLongitude, longitude);
    maxLatitude = Math.max(maxLatitude, latitude);
  }
  return distanceMeters([minLongitude, minLatitude], [maxLongitude, maxLatitude]);
};

const orientation = (a: Position, b: Position, c: Position): number => {
  const ax = a[0];
  const ay = a[1];
  const bx = b[0];
  const by = b[1];
  const cx = c[0];
  const cy = c[1];
  if (
    typeof ax !== 'number' ||
    typeof ay !== 'number' ||
    typeof bx !== 'number' ||
    typeof by !== 'number' ||
    typeof cx !== 'number' ||
    typeof cy !== 'number'
  ) {
    throw new Error('[tileEmit] validated ring lost its numeric coordinates');
  }
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
};

const isPointOnSegment = (start: Position, point: Position, end: Position): boolean => {
  const sx = start[0];
  const sy = start[1];
  const px = point[0];
  const py = point[1];
  const ex = end[0];
  const ey = end[1];
  if (
    typeof sx !== 'number' ||
    typeof sy !== 'number' ||
    typeof px !== 'number' ||
    typeof py !== 'number' ||
    typeof ex !== 'number' ||
    typeof ey !== 'number'
  ) {
    throw new Error('[tileEmit] validated ring lost its numeric coordinates');
  }
  return (
    Math.min(sx, ex) <= px &&
    px <= Math.max(sx, ex) &&
    Math.min(sy, ey) <= py &&
    py <= Math.max(sy, ey)
  );
};

const segmentsIntersect = (
  firstStart: Position,
  firstEnd: Position,
  secondStart: Position,
  secondEnd: Position
): boolean => {
  const firstA = orientation(firstStart, firstEnd, secondStart);
  const firstB = orientation(firstStart, firstEnd, secondEnd);
  const secondA = orientation(secondStart, secondEnd, firstStart);
  const secondB = orientation(secondStart, secondEnd, firstEnd);
  const epsilon = 1e-12;
  if (
    ((firstA > epsilon && firstB < -epsilon) || (firstA < -epsilon && firstB > epsilon)) &&
    ((secondA > epsilon && secondB < -epsilon) || (secondA < -epsilon && secondB > epsilon))
  ) {
    return true;
  }
  if (Math.abs(firstA) <= epsilon && isPointOnSegment(firstStart, secondStart, firstEnd))
    return true;
  if (Math.abs(firstB) <= epsilon && isPointOnSegment(firstStart, secondEnd, firstEnd)) return true;
  if (Math.abs(secondA) <= epsilon && isPointOnSegment(secondStart, firstStart, secondEnd))
    return true;
  return Math.abs(secondB) <= epsilon && isPointOnSegment(secondStart, firstEnd, secondEnd);
};

const ringHasSelfIntersection = (ring: Position[]): boolean => {
  const vertices = ring.slice(0, -1);
  for (let firstIndex = 0; firstIndex < vertices.length; firstIndex += 1) {
    const firstStart = vertices[firstIndex];
    const firstEnd = vertices[(firstIndex + 1) % vertices.length];
    if (!firstStart || !firstEnd) throw new Error('[tileEmit] validated ring lost an edge');
    for (let secondIndex = firstIndex + 1; secondIndex < vertices.length; secondIndex += 1) {
      if (Math.abs(firstIndex - secondIndex) <= 1) continue;
      if (firstIndex === 0 && secondIndex === vertices.length - 1) continue;
      const secondStart = vertices[secondIndex];
      const secondEnd = vertices[(secondIndex + 1) % vertices.length];
      if (!secondStart || !secondEnd) throw new Error('[tileEmit] validated ring lost an edge');
      if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) return true;
    }
  }
  return false;
};

const computePolygonAreaMeters2 = (
  coordinates: Position[][],
  geometryEngine: GeometryEngine
): number => {
  const area = Math.abs(geometryArea({ type: 'Polygon', coordinates } as Polygon, geometryEngine));
  if (!Number.isFinite(area)) {
    throw new Error('[tileEmit] geometry area engine returned a non-finite value');
  }
  return area;
};

const failsCheck = (
  check: TileEmitInvalidGeometryCheck,
  coordinates: Position[][],
  geometryEngine: GeometryEngine
): boolean => {
  const outer = coordinates[0];
  if (!outer) throw new Error('[tileEmit] validated polygon lost its outer ring');
  switch (check) {
    case 'area':
      return (
        computePolygonAreaMeters2(coordinates, geometryEngine) <=
        TILE_EMIT_INVALID_GEOMETRY_FILTER_THRESHOLDS.minAreaMeters2
      );
    case 'lineLength':
      return (
        computeRingLengthMeters(outer) <=
        TILE_EMIT_INVALID_GEOMETRY_FILTER_THRESHOLDS.minLineLengthMeters
      );
    case 'maxEdgeLength': {
      const maxEdgeLength = computeRingMaxEdgeLengthMeters(outer);
      const diagonal = computeRingBoundsDiagonalMeters(outer);
      return (
        maxEdgeLength <= 0 ||
        (diagonal > 0 &&
          maxEdgeLength >
            diagonal * TILE_EMIT_INVALID_GEOMETRY_FILTER_THRESHOLDS.maxEdgeToBBoxDiagonalRatio)
      );
    }
    case 'selfIntersection':
      return coordinates.some((ring) => ringHasSelfIntersection(ring));
    case 'triangleRingRatio': {
      if (outer.length - 1 !== 3) return false;
      const diagonal = computeRingBoundsDiagonalMeters(outer);
      if (diagonal <= 0) return true;
      let minLongitude = Number.POSITIVE_INFINITY;
      let minLatitude = Number.POSITIVE_INFINITY;
      let maxLongitude = Number.NEGATIVE_INFINITY;
      let maxLatitude = Number.NEGATIVE_INFINITY;
      for (const position of outer) {
        const longitude = position[0];
        const latitude = position[1];
        if (typeof longitude !== 'number' || typeof latitude !== 'number') {
          throw new Error('[tileEmit] validated ring lost its numeric coordinates');
        }
        minLongitude = Math.min(minLongitude, longitude);
        minLatitude = Math.min(minLatitude, latitude);
        maxLongitude = Math.max(maxLongitude, longitude);
        maxLatitude = Math.max(maxLatitude, latitude);
      }
      const width = distanceMeters([minLongitude, minLatitude], [maxLongitude, minLatitude]);
      const height = distanceMeters([minLongitude, minLatitude], [minLongitude, maxLatitude]);
      const bboxArea = width * height;
      if (bboxArea <= 0) return true;
      return (
        computePolygonAreaMeters2(coordinates, geometryEngine) / bboxArea <
        TILE_EMIT_INVALID_GEOMETRY_FILTER_THRESHOLDS.minTriangleAreaToBBoxRatio
      );
    }
  }
};

const filterPolygon = async (
  coordinates: Position[][],
  context: FilterContext
): Promise<boolean> => {
  context.polygonIndex += 1;
  for (const check of context.enabledChecks) {
    await context.onProgress?.({
      check,
      polygonIndex: context.polygonIndex,
      polygonTotal: context.polygonTotal,
    });
    if (failsCheck(check, coordinates, context.geometryEngine)) {
      context.filteredByCheck[check] += 1;
      return false;
    }
  }
  return true;
};

const filterGeometry = async (
  geometry: Geometry,
  context: FilterContext
): Promise<{ geometry: Geometry | null; droppedPolygonCount: number }> => {
  if (geometry.type === 'Polygon') {
    const coordinates = assertPolygonCoordinates(
      geometry.coordinates,
      'feature.geometry.coordinates'
    );
    const keep = await filterPolygon(coordinates, context);
    return { geometry: keep ? geometry : null, droppedPolygonCount: keep ? 0 : 1 };
  }
  if (geometry.type === 'MultiPolygon') {
    const filtered: Position[][][] = [];
    let droppedPolygonCount = 0;
    for (const polygon of geometry.coordinates) {
      const coordinates = assertPolygonCoordinates(polygon, 'feature.geometry.coordinates[]');
      if (await filterPolygon(coordinates, context)) filtered.push(coordinates);
      else droppedPolygonCount += 1;
    }
    return {
      geometry:
        filtered.length > 0 ? ({ ...geometry, coordinates: filtered } as MultiPolygon) : null,
      droppedPolygonCount,
    };
  }
  if (geometry.type === 'GeometryCollection') {
    const geometries: Geometry[] = [];
    let droppedPolygonCount = 0;
    for (const child of geometry.geometries) {
      const filtered = await filterGeometry(child, context);
      droppedPolygonCount += filtered.droppedPolygonCount;
      if (filtered.geometry) geometries.push(filtered.geometry);
    }
    return {
      geometry: geometries.length > 0 ? ({ ...geometry, geometries } as GeometryCollection) : null,
      droppedPolygonCount,
    };
  }
  return { geometry, droppedPolygonCount: 0 };
};

const readFeatureErrorCount = (properties: GeoJsonProperties, featureIndex: number): number => {
  const rawValue = properties?.errorCount;
  if (rawValue === undefined) return 0;
  if (
    typeof rawValue !== 'number' ||
    !Number.isFinite(rawValue) ||
    !Number.isInteger(rawValue) ||
    rawValue < 0
  ) {
    throw new Error(
      `[tileEmit] feature[${featureIndex}].properties.errorCount must be a non-negative integer`
    );
  }
  return rawValue;
};

export const filterInvalidGeometryForTileEmit = async (
  collectionValue: unknown,
  options: {
    config: unknown;
    geometryEngine: GeometryEngine;
    onProgress?: (progress: TileEmitInvalidGeometryFilterProgress) => Promise<void> | void;
  }
): Promise<TileEmitInvalidGeometryFilterResult> => {
  const collectionRecord = assertRecord(collectionValue, 'geometry cache payload');
  if (collectionRecord.type !== 'FeatureCollection') {
    throw new Error('[tileEmit] geometry cache payload must be a FeatureCollection');
  }
  const rawFeatures = assertArray(collectionRecord.features, 'geometry cache payload.features');
  const config = assertTileEmitInvalidGeometryFilterConfig(options.config);
  const enabledChecks = CHECK_ORDER.filter((check) => config[check]);
  const sourceFeatures: Feature<Geometry>[] = rawFeatures.map((value, featureIndex) => {
    const featureRecord = assertRecord(value, `feature[${featureIndex}]`);
    if (featureRecord.type !== 'Feature')
      throw new Error(`[tileEmit] feature[${featureIndex}].type must be Feature`);
    if (!featureRecord.geometry || typeof featureRecord.geometry !== 'object') {
      throw new Error(`[tileEmit] feature[${featureIndex}].geometry is required`);
    }
    if (
      featureRecord.properties !== null &&
      featureRecord.properties !== undefined &&
      (typeof featureRecord.properties !== 'object' || Array.isArray(featureRecord.properties))
    ) {
      throw new Error(`[tileEmit] feature[${featureIndex}].properties must be an object or null`);
    }
    const feature = value as Feature<Geometry>;
    validateGeometry(feature.geometry, `feature[${featureIndex}].geometry`);
    readFeatureErrorCount(feature.properties, featureIndex);
    return feature;
  });
  const polygonTotal = sourceFeatures.reduce(
    (total, feature) => total + countPolygons(feature.geometry),
    0
  );
  const context: FilterContext = {
    config,
    geometryEngine: options.geometryEngine,
    enabledChecks,
    polygonTotal,
    polygonIndex: 0,
    filteredByCheck: createCheckCounter(),
    onProgress: options.onProgress,
  };
  const filteredFeatures: FilteredTileEmitFeature[] = [];
  let invalidPolygonFilteredCount = 0;
  let affectedFeatureCount = 0;
  let featureErrorCountTotal = 0;

  for (let featureIndex = 0; featureIndex < sourceFeatures.length; featureIndex += 1) {
    const sourceFeature = sourceFeatures[featureIndex];
    if (!sourceFeature) throw new Error(`[tileEmit] feature[${featureIndex}] is missing`);
    const filtered = await filterGeometry(sourceFeature.geometry, context);
    const existingErrorCount = readFeatureErrorCount(sourceFeature.properties, featureIndex);
    invalidPolygonFilteredCount += filtered.droppedPolygonCount;
    if (filtered.droppedPolygonCount > 0) {
      affectedFeatureCount += 1;
      featureErrorCountTotal += existingErrorCount + filtered.droppedPolygonCount;
    }
    if (!filtered.geometry) continue;
    const properties =
      filtered.droppedPolygonCount > 0
        ? {
            ...(sourceFeature.properties ?? {}),
            errorCount: existingErrorCount + filtered.droppedPolygonCount,
          }
        : sourceFeature.properties;
    const feature: Feature<Geometry> = {
      ...sourceFeature,
      geometry: filtered.geometry,
      properties,
    };
    delete feature.bbox;
    filteredFeatures.push({ sourceFeature, feature });
  }

  const invalidPolygonCheckedCount = enabledChecks.length > 0 ? polygonTotal : 0;
  return {
    collection: {
      ...(collectionValue as FeatureCollection),
      features: filteredFeatures.map((entry) => entry.feature),
    },
    filteredFeatures,
    metrics: {
      invalidPolygonFilteredCount,
      invalidPolygonCheckedCount,
      invalidPolygonFilteredRate:
        invalidPolygonCheckedCount > 0
          ? invalidPolygonFilteredCount / invalidPolygonCheckedCount
          : 0,
      affectedFeatureCount,
      featureErrorCountTotal,
      invalidPolygonFilteredByCheck: context.filteredByCheck,
    },
  };
};
