import type { Feature, FeatureCollection, Geometry, LineString, MultiPolygon, Polygon } from 'geojson';
import { area as turfArea, bbox as turfBbox, booleanValid as turfBooleanValid, kinks as turfKinks } from '@turf/turf';
import { cleanCoords } from '@turf/clean-coords';
import { geojson as geojsonApi } from 'flatgeobuf';
import { applyFeatureFiltering, encodeFlatGeobufFromFeatureCollection, latToTileY, lonToTileX } from '@hierarchidb/gis-sdk';
import type { ShapeTransformErrorRecord } from '@hierarchidb/plugin-service-api';
import { simplifyFeatureCollection, buildBoundaryFeature, snapGeometryToGrid } from './geometry.js';
import { SHAPE_DOMAIN } from '@hierarchidb/vt-shape-store';
import type { TransformByBandStageContext } from '../contexts.js';
import type { StageHandler, StageHandlerResult, TransformByBandTaskInput } from '../types/types.js';
import { VtTaskQueueDb, updateTask } from '../task/taskQueue.js';
import { packTileId } from '../tiles/tileId.js';

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

const decodeFetchCache = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  return normalizeFeatureCollection(decoded as unknown);
};

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
    return geometries.reduce((sum: number, child: Geometry) => sum + countVerticesFromGeometry(child), 0);
  }
  return countVertices(geometry.coordinates);
};

const countPolygonsFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum: number, child: Geometry) => sum + countPolygonsFromGeometry(child), 0);
  }
  if (geometry.type === 'Polygon') {
    return 1;
  }
  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;
  }
  return 0;
};

const clampTileIndex = (value: number, maxIndex: number): number => (
  Math.min(maxIndex, Math.max(0, value))
);

const collectTileIdsForCollection = (collection: FeatureCollection, zBase: number): number[] => {
  if (!Number.isFinite(zBase) || zBase < 0) return [];
  const maxIndex = (1 << zBase) - 1;
  const tileIds = new Set<number>();
  for (const feature of collection.features) {
    if (!feature?.geometry) continue;
    const [minLon, minLat, maxLon, maxLat] = turfBbox(feature as Feature<Geometry>);
    if (![minLon, minLat, maxLon, maxLat].every((value) => Number.isFinite(value))) continue;
    const x1 = clampTileIndex(lonToTileX(minLon, zBase), maxIndex);
    const x2 = clampTileIndex(lonToTileX(maxLon, zBase), maxIndex);
    const y1 = clampTileIndex(latToTileY(maxLat, zBase), maxIndex);
    const y2 = clampTileIndex(latToTileY(minLat, zBase), maxIndex);
    for (let x = x1; x <= x2; x += 1) {
      for (let y = y1; y <= y2; y += 1) {
        tileIds.add(packTileId(x, y, zBase));
      }
    }
  }
  return [...tileIds];
};

type ErrorRingRole = 'outline' | 'hole';
type ErrorLineProperties = {
  ringRole: ErrorRingRole;
  polygonIndex: number;
  ringIndex: number;
  featureId?: string;
};

const buildErrorLineFeatures = (
  geometry: Geometry,
  featureId?: string,
): { features: Array<Feature<LineString, ErrorLineProperties>>; polygonCount: number; ringCount: number; geometryType: string } | null => {
  const features: Array<Feature<LineString, ErrorLineProperties>> = [];
  let polygonCount = 0;
  let ringCount = 0;
  const pushRing = (ring: number[][], ringRole: ErrorRingRole, polygonIndex: number, ringIndex: number) => {
    if (!Array.isArray(ring) || ring.length < 2) return;
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: ring },
      properties: { ringRole, polygonIndex, ringIndex, featureId },
    });
    ringCount += 1;
  };
  if (geometry.type === 'Polygon') {
    const rings = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    polygonCount = rings.length > 0 ? 1 : 0;
    rings.forEach((ring, index) => {
      const ringRole: ErrorRingRole = index === 0 ? 'outline' : 'hole';
      pushRing(ring as number[][], ringRole, 0, index);
    });
  } else if (geometry.type === 'MultiPolygon') {
    const polygons = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    polygonCount = polygons.length;
    polygons.forEach((rings, polygonIndex) => {
      (rings ?? []).forEach((ring, ringIndex) => {
        const ringRole: ErrorRingRole = ringIndex === 0 ? 'outline' : 'hole';
        pushRing(ring as number[][], ringRole, polygonIndex, ringIndex);
      });
    });
  } else {
    return null;
  }
  return features.length ? { features, polygonCount, ringCount, geometryType: geometry.type } : null;
};

type GeometryIssueSummary = {
  geometryType: string;
  polygonCount: number;
  ringCount: number;
  errorPolygonCount: number;
  errorRingCount: number;
  emptyRingCount: number;
  invalidRingCount: number;
  openRingCount: number;
  nonFiniteCoordCount: number;
  minRingVertices: number | null;
  maxRingVertices: number | null;
  avgRingVertices: number | null;
  degenerateRingCount: number;
  duplicateVertexCount: number;
  minRingArea: number | null;
  maxRingArea: number | null;
  selfIntersectionCount: number;
};

type PolygonRingSummary = {
  emptyRingCount: number;
  invalidRingCount: number;
  openRingCount: number;
  nonFiniteCoordCount: number;
  ringVertices: number;
  ringArea: number | null;
  degenerateRingCount: number;
  duplicateVertexCount: number;
  hasIssue: boolean;
};

const isSameCoord = (a?: number[], b?: number[]): boolean => {
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1];
};

const countDuplicateVertices = (ring: number[][]): number => {
  let count = 0;
  for (let index = 1; index < ring.length; index += 1) {
    if (isSameCoord(ring[index], ring[index - 1])) {
      count += 1;
    }
  }
  return count;
};

const computeRingArea = (ring: number[][]): number | null => {
  if (ring.length < 3) return null;
  const isClosed = ring.length > 2 && isSameCoord(ring[0], ring[ring.length - 1]);
  const coords = isClosed ? ring.slice(0, -1) : ring;
  if (coords.length < 3) return null;
  let sum = 0;
  for (let index = 0; index < coords.length; index += 1) {
    const coord1 = coords[index];
    const coord2 = coords[(index + 1) % coords.length];
    if (!coord1 || !coord2) continue;
    if (coord1.length < 2 || coord2.length < 2) continue;
    const x1 = coord1[0];
    const y1 = coord1[1];
    const x2 = coord2[0];
    const y2 = coord2[1];
    if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) continue;
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
      continue;
    }
    sum += (x1 * y2) - (x2 * y1);
  }
  return sum / 2;
};

const countSelfIntersections = (geometry: Geometry): number => {
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return 0;
  try {
    const polygonGeometry = geometry as Polygon | MultiPolygon;
    const feature: Feature<Polygon | MultiPolygon> = { type: 'Feature', geometry: polygonGeometry, properties: {} };
    const result = turfKinks(feature);
    return Array.isArray(result?.features) ? result.features.length : 0;
  } catch {
    return 0;
  }
};

const analyzePolygonRing = (ring: number[][]): PolygonRingSummary => {
  const ringVertices = ring.length;
  let nonFiniteCoordCount = 0;
  for (const point of ring) {
    if (!Array.isArray(point) || point.length < 2) {
      nonFiniteCoordCount += 1;
      continue;
    }
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
      nonFiniteCoordCount += 1;
    }
  }
  const emptyRingCount = ringVertices === 0 ? 1 : 0;
  const invalidRingCount = ringVertices > 0 && ringVertices < 4 ? 1 : 0;
  const openRingCount = (() => {
    if (ringVertices < 2) return 0;
    const first = ring[0];
    const last = ring[ringVertices - 1];
    if (!first || !last) return 0;
    return (first[0] !== last[0] || first[1] !== last[1]) ? 1 : 0;
  })();
  const ringArea = computeRingArea(ring);
  const degenerateRingCount = ringArea !== null && Math.abs(ringArea) < 1e-12 ? 1 : 0;
  const duplicateVertexCount = countDuplicateVertices(ring);
  const hasIssue = emptyRingCount > 0
    || invalidRingCount > 0
    || openRingCount > 0
    || nonFiniteCoordCount > 0
    || degenerateRingCount > 0
    || duplicateVertexCount > 0;
  return {
    emptyRingCount,
    invalidRingCount,
    openRingCount,
    nonFiniteCoordCount,
    ringVertices,
    ringArea,
    degenerateRingCount,
    duplicateVertexCount,
    hasIssue,
  };
};

const analyzePolygon = (rings: number[][][]): Omit<GeometryIssueSummary, 'geometryType'> => {
  let emptyRingCount = 0;
  let invalidRingCount = 0;
  let openRingCount = 0;
  let nonFiniteCoordCount = 0;
  let minRingVertices: number | null = null;
  let maxRingVertices: number | null = null;
  let ringVertexTotal = 0;
  let ringCount = 0;
  let errorRingCount = 0;
  let errorPolygonCount = 0;
  let polygonHasIssue = false;
  let degenerateRingCount = 0;
  let duplicateVertexCount = 0;
  let minRingArea: number | null = null;
  let maxRingArea: number | null = null;
  for (const ring of rings) {
    const result = analyzePolygonRing(ring ?? []);
    emptyRingCount += result.emptyRingCount;
    invalidRingCount += result.invalidRingCount;
    openRingCount += result.openRingCount;
    nonFiniteCoordCount += result.nonFiniteCoordCount;
    degenerateRingCount += result.degenerateRingCount;
    duplicateVertexCount += result.duplicateVertexCount;
    ringCount += 1;
    ringVertexTotal += result.ringVertices;
    if (minRingVertices === null || result.ringVertices < minRingVertices) {
      minRingVertices = result.ringVertices;
    }
    if (maxRingVertices === null || result.ringVertices > maxRingVertices) {
      maxRingVertices = result.ringVertices;
    }
    if (typeof result.ringArea === 'number') {
      minRingArea = minRingArea === null ? result.ringArea : Math.min(minRingArea, result.ringArea);
      maxRingArea = maxRingArea === null ? result.ringArea : Math.max(maxRingArea, result.ringArea);
    }
    if (result.hasIssue) {
      errorRingCount += 1;
      polygonHasIssue = true;
    }
  }
  errorPolygonCount = polygonHasIssue ? 1 : 0;
  return {
    polygonCount: 1,
    ringCount,
    errorPolygonCount,
    errorRingCount,
    emptyRingCount,
    invalidRingCount,
    openRingCount,
    nonFiniteCoordCount,
    minRingVertices,
    maxRingVertices,
    avgRingVertices: ringCount > 0 ? ringVertexTotal / ringCount : null,
    degenerateRingCount,
    duplicateVertexCount,
    minRingArea,
    maxRingArea,
    selfIntersectionCount: 0,
  };
};

const buildEmptyGeometrySummary = (geometryType: string): GeometryIssueSummary => ({
  geometryType,
  polygonCount: 0,
  ringCount: 0,
  errorPolygonCount: 0,
  errorRingCount: 0,
  emptyRingCount: 0,
  invalidRingCount: 0,
  openRingCount: 0,
  nonFiniteCoordCount: 0,
  minRingVertices: null,
  maxRingVertices: null,
  avgRingVertices: null,
  degenerateRingCount: 0,
  duplicateVertexCount: 0,
  minRingArea: null,
  maxRingArea: null,
  selfIntersectionCount: 0,
});

const analyzeGeometryIssues = (geometry?: Geometry | null): GeometryIssueSummary => {
  if (!geometry) return buildEmptyGeometrySummary('none');

  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    let ringVertexTotal = 0;
    let ringCount = 0;
    const summary = geometries.reduce<GeometryIssueSummary>((acc, child) => {
      const childSummary = analyzeGeometryIssues(child);
      acc.polygonCount += childSummary.polygonCount;
      acc.ringCount += childSummary.ringCount;
      acc.errorPolygonCount += childSummary.errorPolygonCount;
      acc.errorRingCount += childSummary.errorRingCount;
      acc.emptyRingCount += childSummary.emptyRingCount;
      acc.invalidRingCount += childSummary.invalidRingCount;
      acc.openRingCount += childSummary.openRingCount;
      acc.nonFiniteCoordCount += childSummary.nonFiniteCoordCount;
      acc.degenerateRingCount += childSummary.degenerateRingCount;
      acc.duplicateVertexCount += childSummary.duplicateVertexCount;
      acc.selfIntersectionCount += childSummary.selfIntersectionCount;
      if (childSummary.minRingVertices !== null) {
        acc.minRingVertices = acc.minRingVertices === null
          ? childSummary.minRingVertices
          : Math.min(acc.minRingVertices, childSummary.minRingVertices);
      }
      if (childSummary.maxRingVertices !== null) {
        acc.maxRingVertices = acc.maxRingVertices === null
          ? childSummary.maxRingVertices
          : Math.max(acc.maxRingVertices, childSummary.maxRingVertices);
      }
      if (childSummary.minRingArea !== null) {
        acc.minRingArea = acc.minRingArea === null
          ? childSummary.minRingArea
          : Math.min(acc.minRingArea, childSummary.minRingArea);
      }
      if (childSummary.maxRingArea !== null) {
        acc.maxRingArea = acc.maxRingArea === null
          ? childSummary.maxRingArea
          : Math.max(acc.maxRingArea, childSummary.maxRingArea);
      }
      if (childSummary.avgRingVertices !== null && childSummary.ringCount > 0) {
        ringVertexTotal += childSummary.avgRingVertices * childSummary.ringCount;
        ringCount += childSummary.ringCount;
      }
      acc.geometryType = `${acc.geometryType}+${childSummary.geometryType}`;
      return acc;
    }, buildEmptyGeometrySummary('GeometryCollection'));
    summary.avgRingVertices = ringCount > 0 ? ringVertexTotal / ringCount : null;
    return summary;
  }

  if (geometry.type === 'Polygon') {
    const rings = Array.isArray(geometry.coordinates)
      ? (geometry.coordinates as number[][][])
      : [];
    const summary = {
      geometryType: 'Polygon',
      ...analyzePolygon(rings),
      selfIntersectionCount: countSelfIntersections(geometry),
    };
    if (summary.selfIntersectionCount > 0 && summary.errorPolygonCount === 0 && summary.polygonCount > 0) {
      summary.errorPolygonCount = summary.polygonCount;
    }
    return summary;
  }

  if (geometry.type === 'MultiPolygon') {
    const polygons = Array.isArray(geometry.coordinates)
      ? (geometry.coordinates as number[][][][])
      : [];
    let ringVertexTotal = 0;
    let ringCount = 0;
    const summary = polygons.reduce<GeometryIssueSummary>((acc, polygon) => {
      const child = analyzePolygon(polygon ?? []);
      acc.polygonCount += child.polygonCount;
      acc.ringCount += child.ringCount;
      acc.errorPolygonCount += child.errorPolygonCount;
      acc.errorRingCount += child.errorRingCount;
      acc.emptyRingCount += child.emptyRingCount;
      acc.invalidRingCount += child.invalidRingCount;
      acc.openRingCount += child.openRingCount;
      acc.nonFiniteCoordCount += child.nonFiniteCoordCount;
      acc.degenerateRingCount += child.degenerateRingCount;
      acc.duplicateVertexCount += child.duplicateVertexCount;
      if (child.minRingVertices !== null) {
        acc.minRingVertices = acc.minRingVertices === null
          ? child.minRingVertices
          : Math.min(acc.minRingVertices, child.minRingVertices);
      }
      if (child.maxRingVertices !== null) {
        acc.maxRingVertices = acc.maxRingVertices === null
          ? child.maxRingVertices
          : Math.max(acc.maxRingVertices, child.maxRingVertices);
      }
      if (child.minRingArea !== null) {
        acc.minRingArea = acc.minRingArea === null
          ? child.minRingArea
          : Math.min(acc.minRingArea, child.minRingArea);
      }
      if (child.maxRingArea !== null) {
        acc.maxRingArea = acc.maxRingArea === null
          ? child.maxRingArea
          : Math.max(acc.maxRingArea, child.maxRingArea);
      }
      if (child.avgRingVertices !== null && child.ringCount > 0) {
        ringVertexTotal += child.avgRingVertices * child.ringCount;
        ringCount += child.ringCount;
      }
      return acc;
    }, buildEmptyGeometrySummary('MultiPolygon'));
    summary.selfIntersectionCount = countSelfIntersections(geometry);
    if (summary.selfIntersectionCount > 0 && summary.errorPolygonCount === 0 && summary.polygonCount > 0) {
      summary.errorPolygonCount = summary.polygonCount;
    }
    summary.avgRingVertices = ringCount > 0 ? ringVertexTotal / ringCount : null;
    return summary;
  }

  return buildEmptyGeometrySummary(geometry.type);
};


const isGeometryBooleanValid = (geometry?: Geometry | null): boolean => {
  if (!geometry) return true;
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return true;
  try {
    const feature: Feature<Polygon | MultiPolygon> = { type: 'Feature', geometry, properties: {} };
    return turfBooleanValid(feature);
  } catch {
    return false;
  }
};

const filterFeaturesByAspectRatioAndArea = (
  features: Feature[],
  aspectRatioThreshold: number,
  areaThreshold: number,
): Feature[] => {
  if (aspectRatioThreshold <= 0 && areaThreshold <= 0) return features;
  return features.filter((feature) => {
    if (!feature?.geometry) return false;
    if (areaThreshold > 0) {
      const areaSqKm = turfArea(feature as Feature<Geometry>) / 1_000_000;
      if (areaSqKm < areaThreshold) return false;
    }
    if (aspectRatioThreshold > 0) {
      const [minX, minY, maxX, maxY] = turfBbox(feature as Feature<Geometry>);
      const width = Math.abs(maxX - minX);
      const height = Math.abs(maxY - minY);
      const ratio = width == 0 || height == 0 ? Number.POSITIVE_INFINITY : Math.max(width / height, height / width);
      if (ratio > aspectRatioThreshold) return false;
    }
    return true;
  });
};

const assertNotAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new Error('task aborted');
  }
};

const formatArea = (value: number | null): string => (
  value === null || !Number.isFinite(value) ? '-' : value.toExponential(2)
);

const formatAverage = (value: number | null): string => (
  value === null || !Number.isFinite(value) ? '-' : value.toFixed(2)
);

const runStageWithLabel = async <T>(label: string, fn: () => T | Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    throw new Error(`stage=${label} ${err}`);
  }
};

const buildCollectionDiagnostics = (collection: FeatureCollection | null, label: string): string | null => {
  if (!collection) return null;
  const featureCount = collection.features.length;
  const missingGeometry = collection.features.filter((feature) => !feature?.geometry).length;
  const polygonCount = collection.features.reduce(
    (sum, feature) => sum + countPolygonsFromGeometry(feature?.geometry),
    0,
  );
  let invalidFeatureCount = 0;
  let invalidRingCount = 0;
  let openRingCount = 0;
  let emptyRingCount = 0;
  let nonFiniteCoordCount = 0;
  let minRingVertices: number | null = null;
  let maxRingVertices: number | null = null;
  let ringVertexTotal = 0;
  let ringCount = 0;
  let degenerateRingCount = 0;
  let duplicateVertexCount = 0;
  let selfIntersectionCount = 0;
  let minRingArea: number | null = null;
  let maxRingArea: number | null = null;
  const sampleDetails: string[] = [];
  for (const feature of collection.features) {
    if (!feature?.geometry) continue;
    const summary = analyzeGeometryIssues(feature.geometry);
    invalidRingCount += summary.invalidRingCount;
    openRingCount += summary.openRingCount;
    emptyRingCount += summary.emptyRingCount;
    nonFiniteCoordCount += summary.nonFiniteCoordCount;
    degenerateRingCount += summary.degenerateRingCount;
    duplicateVertexCount += summary.duplicateVertexCount;
    selfIntersectionCount += summary.selfIntersectionCount;
    const isValid = isGeometryBooleanValid(feature.geometry);
    if (!isValid) {
      invalidFeatureCount += 1;
    }
    if (summary.minRingVertices !== null) {
      minRingVertices = minRingVertices === null
        ? summary.minRingVertices
        : Math.min(minRingVertices, summary.minRingVertices);
    }
    if (summary.maxRingVertices !== null) {
      maxRingVertices = maxRingVertices === null
        ? summary.maxRingVertices
        : Math.max(maxRingVertices, summary.maxRingVertices);
    }
    if (summary.minRingArea !== null) {
      minRingArea = minRingArea === null
        ? summary.minRingArea
        : Math.min(minRingArea, summary.minRingArea);
    }
    if (summary.maxRingArea !== null) {
      maxRingArea = maxRingArea === null
        ? summary.maxRingArea
        : Math.max(maxRingArea, summary.maxRingArea);
    }
    if (summary.avgRingVertices !== null && summary.ringCount > 0) {
      ringVertexTotal += summary.avgRingVertices * summary.ringCount;
      ringCount += summary.ringCount;
    }
    if (sampleDetails.length < 3) {
      const featureId = feature.id
        ?? (feature.properties && 'id' in feature.properties ? String(feature.properties.id) : undefined)
        ?? `${label}:${sampleDetails.length}`;
      sampleDetails.push(
        `${featureId} type=${summary.geometryType} rings=${summary.ringCount} minRingVertices=${summary.minRingVertices ?? '-'} kinks=${summary.selfIntersectionCount} degenerateRings=${summary.degenerateRingCount} minRingArea=${formatArea(summary.minRingArea)} invalidRings=${summary.invalidRingCount} openRings=${summary.openRingCount} nonFinite=${summary.nonFiniteCoordCount} booleanValid=${isValid ? '1' : '0'}`,
      );
    }
  }
  const avgRingVertices = ringCount > 0 ? ringVertexTotal / ringCount : null;
  const summary = `${label} (features=${featureCount}, polygons=${polygonCount}, missingGeometry=${missingGeometry}, invalidFeatures=${invalidFeatureCount}) (invalidRings=${invalidRingCount}, openRings=${openRingCount}, emptyRings=${emptyRingCount}, nonFiniteCoords=${nonFiniteCoordCount}, minRingVertices=${minRingVertices ?? '-'}) (selfIntersections=${selfIntersectionCount}, degenerateRings=${degenerateRingCount}, duplicateVertices=${duplicateVertexCount}, minRingArea=${formatArea(minRingArea)}, maxRingArea=${formatArea(maxRingArea)}, maxRingVertices=${maxRingVertices ?? '-'}, avgRingVertices=${formatAverage(avgRingVertices)})`;
  return sampleDetails.length ? `${summary} (samples=${sampleDetails.join(' | ')})` : summary;
};

export const createTransformByBandHandler = (
  context: TransformByBandStageContext
): StageHandler<TransformByBandTaskInput> => {
  const { shapeDB, ephemeralDB, transformConfig, bands, abortSignal } = context;
  const taskQueue = new VtTaskQueueDb();
  const reportPolygonProgress = async (
    taskId: string,
    processedPolygons: number,
    totalPolygons: number,
  ): Promise<void> => {
    const total = Math.max(0, Math.round(totalPolygons));
    const processed = Math.max(0, Math.round(processedPolygons));
    const progress = total > 0 ? Math.min(100, Math.max(0, Math.round((processed / total) * 100))) : 0;
    try {
      await updateTask(taskQueue, taskId, {
        progress,
        outputData: {
          processedPolygons: processed,
          totalPolygons: total,
        },
      });
    } catch (error) {
      console.warn('[transform] failed to report polygon progress', error);
    }
  };
  // Feature filtering is intentionally disabled during transform stage while investigating geometry distortion.
  const enableFeatureFiltering = false;
  const tolerance = transformConfig.tolerance;
  if (typeof tolerance !== 'number') {
    throw new Error('transform requires tolerance');
  }
  const bandMap = new Map(bands.map((band) => [band.bandId, band] as const));

  return async (task): Promise<StageHandlerResult> => {
    const input = task.inputData;
    if (!input) {
      return { status: 'failed', errorMessage: 'transform failed: task input is missing' };
    }
    const band = bandMap.get(input.bandId);
    if (!band) {
      return { status: 'failed', errorMessage: `transform failed: unknown bandId (${input.bandId})` };
    }

    let workingCollection: FeatureCollection | null = null;
    let simplified: FeatureCollection | null = null;
    let outputCollection: FeatureCollection | null = null;
    let stageLabel = 'start';
    let inputPolygonCount = 0;

    try {
      stageLabel = 'fetch:cache';
      assertNotAborted(abortSignal);
      const fetchCache = await shapeDB.fetchCache.get(input.fetchCacheId);
      if (!fetchCache) {
        return { status: 'failed', errorMessage: 'transform failed: fetch cache not found' };
      }

      stageLabel = 'decode';
      assertNotAborted(abortSignal);
      const collection = await runStageWithLabel('decode', () => decodeFetchCache(fetchCache.data));
      if (!collection || collection.features.length === 0) {
        return { status: 'failed', errorMessage: 'transform failed: empty fetch cache' };
      }

      workingCollection = collection;
      if (enableFeatureFiltering && transformConfig.enableFeatureFiltering) {
        stageLabel = 'filter:featureFiltering';
        assertNotAborted(abortSignal);
        const filtered = await runStageWithLabel('filter:featureFiltering', () => applyFeatureFiltering(workingCollection, {
          minArea: transformConfig.featureAreaThreshold,
          featureFilterMethod: transformConfig.featureFilterMethod,
          minVertexCountForAreaFilter: transformConfig.minVertexCountForAreaFilter,
          hybridFilterConfig: transformConfig.hybridFilterConfig,
        }));
        if (filtered && typeof filtered === 'object' && (filtered as FeatureCollection).type === 'FeatureCollection') {
          workingCollection = filtered as FeatureCollection;
        }
        const filterTarget = workingCollection;
        if (!filterTarget) {
          return { status: 'failed', errorMessage: 'transform failed: empty working collection before filters' };
        }
        stageLabel = 'filter:aspectArea';
        const filteredFeatures = await runStageWithLabel('filter:aspectArea', () => filterFeaturesByAspectRatioAndArea(
          filterTarget.features,
          transformConfig.aspectRatioThreshold,
          transformConfig.areaThreshold,
        ));
        workingCollection = { ...filterTarget, features: filteredFeatures };
      }

      assertNotAborted(abortSignal);
      const inputCollection = workingCollection;
      if (!inputCollection) {
        return { status: 'failed', errorMessage: 'transform failed: empty working collection' };
      }
      const inputFeatureCount = inputCollection.features.length;
      const inputMissingGeometry = inputCollection.features.filter((feature) => !feature?.geometry).length;
      stageLabel = 'counts:input-polygons';
      inputPolygonCount = await runStageWithLabel('counts:input-polygons', () => inputCollection.features.reduce(
        (sum, feature) => sum + countPolygonsFromGeometry(feature?.geometry),
        0,
      ));
      await reportPolygonProgress(task.taskId, 0, inputPolygonCount);
      try {
        assertNotAborted(abortSignal);
        stageLabel = 'simplify';
        simplified = await runStageWithLabel('simplify', () => simplifyFeatureCollection(
          inputCollection,
          band.zMax,
          tolerance,
          transformConfig.ringFixConfig,
          transformConfig.selfIntersectionConfig,
          transformConfig.preSimplifyFilterConfig,
          transformConfig.quantize,
          transformConfig.excludePolygonAreaCoefficient,
        ));
      } catch (error) {
        if (abortSignal?.aborted) {
          throw error;
        }
        const err = error instanceof Error ? error.message : String(error);
        let errorFeatureCount = 0;
        let errorPolygonCount = 0;
        let invalidRingCount = 0;
        let openRingCount = 0;
        let emptyRingCount = 0;
        let nonFiniteCoordCount = 0;
        let invalidFeatureCount = 0;
        let invalidAfterSnapCount = 0;
        let invalidAfterCleanCount = 0;
        let minRingVertices: number | null = null;
        let maxRingVertices: number | null = null;
        let ringVertexTotal = 0;
        let ringCount = 0;
        let degenerateRingCount = 0;
        let duplicateVertexCount = 0;
        let selfIntersectionCount = 0;
        let minRingArea: number | null = null;
        let maxRingArea: number | null = null;
        const sampleDetails: string[] = [];
        const analysisErrors: string[] = [];
        const errorRecords: ShapeTransformErrorRecord[] = [];
        for (const [featureIndex, feature] of inputCollection.features.entries()) {
          assertNotAborted(abortSignal);
          if (!feature?.geometry) continue;
          try {
            simplifyFeatureCollection(
              { type: 'FeatureCollection', features: [feature] },
              band.zMax,
              tolerance,
              transformConfig.ringFixConfig,
              transformConfig.selfIntersectionConfig,
              transformConfig.preSimplifyFilterConfig,
              transformConfig.quantize,
              transformConfig.excludePolygonAreaCoefficient,
            );
          } catch (featureError) {
            errorFeatureCount += 1;
            const featureMessage = featureError instanceof Error ? featureError.message : String(featureError);
            const rawFeatureId = feature.id
              ?? (feature.properties && 'id' in feature.properties ? String(feature.properties.id) : undefined);
            const recordFeatureId = rawFeatureId != null
              ? String(rawFeatureId)
              : `${input.sourceKey}:${featureIndex}`;
            const lineFeaturesCandidate = buildErrorLineFeatures(feature.geometry, recordFeatureId);
            const recordId = `${task.taskId}:${recordFeatureId}`;
            const fallbackGeometryType = feature.geometry?.type ?? 'unknown';
            const summary = analyzeGeometryIssues(feature.geometry);
            const recordPolygonCount = summary.polygonCount;
            const recordRingCount = summary.ringCount;
            const recordPolygonErrorCount = summary.errorPolygonCount > 0
              ? summary.errorPolygonCount
              : recordPolygonCount;
            const recordRingErrorCount = summary.errorRingCount > 0
              ? summary.errorRingCount
              : recordRingCount;
            try {
              stageLabel = 'counts:error-polygons';
              errorPolygonCount += await runStageWithLabel('counts:error-polygons', () => countPolygonsFromGeometry(feature.geometry));
              stageLabel = 'analysis:geometry-issues';
              invalidRingCount += summary.invalidRingCount;
              openRingCount += summary.openRingCount;
              emptyRingCount += summary.emptyRingCount;
              nonFiniteCoordCount += summary.nonFiniteCoordCount;
              degenerateRingCount += summary.degenerateRingCount;
              duplicateVertexCount += summary.duplicateVertexCount;
              selfIntersectionCount += summary.selfIntersectionCount;
              const isValid = isGeometryBooleanValid(feature.geometry);
              if (!isValid) {
                invalidFeatureCount += 1;
              }
              stageLabel = 'analysis:snap';
              const snappedGeometry = snapGeometryToGrid(feature.geometry, band.zMax, transformConfig.quantize);
              stageLabel = 'analysis:snap-summary';
              const snappedSummary = analyzeGeometryIssues(snappedGeometry);
              const snappedValid = isGeometryBooleanValid(snappedGeometry);
              if (!snappedValid) {
                invalidAfterSnapCount += 1;
              }
              stageLabel = 'analysis:clean';
              const cleanedGeometry = cleanCoords({
                type: 'Feature',
                geometry: snappedGeometry,
                properties: {},
              }).geometry ?? snappedGeometry;
              stageLabel = 'analysis:clean-summary';
              const cleanedSummary = analyzeGeometryIssues(cleanedGeometry);
              const cleanedValid = isGeometryBooleanValid(cleanedGeometry);
              if (!cleanedValid) {
                invalidAfterCleanCount += 1;
              }
              if (summary.minRingVertices !== null) {
                minRingVertices = minRingVertices === null
                  ? summary.minRingVertices
                  : Math.min(minRingVertices, summary.minRingVertices);
              }
              if (summary.maxRingVertices !== null) {
                maxRingVertices = maxRingVertices === null
                  ? summary.maxRingVertices
                  : Math.max(maxRingVertices, summary.maxRingVertices);
              }
              if (summary.minRingArea !== null) {
                minRingArea = minRingArea === null
                  ? summary.minRingArea
                  : Math.min(minRingArea, summary.minRingArea);
              }
              if (summary.maxRingArea !== null) {
                maxRingArea = maxRingArea === null
                  ? summary.maxRingArea
                  : Math.max(maxRingArea, summary.maxRingArea);
              }
              if (summary.avgRingVertices !== null && summary.ringCount > 0) {
                ringVertexTotal += summary.avgRingVertices * summary.ringCount;
                ringCount += summary.ringCount;
              }
              if (sampleDetails.length < 3) {
                const featureId = feature.id
                  ?? (feature.properties && 'id' in feature.properties ? String(feature.properties.id) : undefined)
                  ?? `${input.sourceKey}:${sampleDetails.length}`;
                sampleDetails.push(
                  `${featureId} type=${summary.geometryType} rings=${summary.ringCount} minRingVertices=${summary.minRingVertices ?? '-'} kinks=${summary.selfIntersectionCount} degenerateRings=${summary.degenerateRingCount} minRingArea=${formatArea(summary.minRingArea)} invalidRings=${summary.invalidRingCount} openRings=${summary.openRingCount} nonFinite=${summary.nonFiniteCoordCount} booleanValid=${isValid ? '1' : '0'} validity=orig:${isValid ? '1' : '0'} snap:${snappedValid ? '1' : '0'} clean:${cleanedValid ? '1' : '0'} minRingAreaStage=orig:${formatArea(summary.minRingArea)} snap:${formatArea(snappedSummary.minRingArea)} clean:${formatArea(cleanedSummary.minRingArea)}`,
                );
              }
            } catch (analysisError) {
              const analysisMessage = analysisError instanceof Error ? analysisError.message : String(analysisError);
              if (analysisErrors.length < 3) {
                analysisErrors.push(`analysisFailed stage=${stageLabel} ${analysisMessage}`);
              }
            }
            errorRecords.push({
              id: recordId,
              nodeId: task.nodeId,
              taskId: task.taskId,
              stage: 'transform',
              bandId: input.bandId,
              sourceKey: input.sourceKey,
              countryCode: input.countryCode,
              adminLevel: input.adminLevel,
              featureId: recordFeatureId,
              featureIndex,
              geometryType: lineFeaturesCandidate?.geometryType ?? fallbackGeometryType,
              polygonCount: recordPolygonCount,
              ringCount: recordRingCount,
              polygonErrorCount: recordPolygonErrorCount,
              ringErrorCount: recordRingErrorCount,
              message: featureMessage,
              createdAt: Date.now(),
              lineFeatures: {
                type: 'FeatureCollection',
                features: lineFeaturesCandidate?.features ?? [],
              },
            });
          }
        }
        if (errorRecords.length > 0) {
          try {
            await ephemeralDB.transformErrors.bulkPut(errorRecords);
          } catch (storageError) {
            console.warn('[ShapeTransform] failed to persist transform error details', storageError);
          }
        }
        const avgRingVertices = ringCount > 0 ? ringVertexTotal / ringCount : null;
        const analysisNote = analysisErrors.length ? ` (analysisErrors=${analysisErrors.join(' | ')})` : '';
        await reportPolygonProgress(task.taskId, 0, inputPolygonCount);
        return {
          status: 'failed',
          errorMessage: `transform failed: geometry simplify error (extract1/${band.zMax}) (${err}) (invalidFeatures=${errorFeatureCount}/${inputFeatureCount}, invalidPolygons=${errorPolygonCount}/${inputPolygonCount}, missingGeometry=${inputMissingGeometry}, invalidGeometries=${invalidFeatureCount}, invalidAfterSnap=${invalidAfterSnapCount}, invalidAfterClean=${invalidAfterCleanCount}) (invalidRings=${invalidRingCount}, openRings=${openRingCount}, emptyRings=${emptyRingCount}, nonFiniteCoords=${nonFiniteCoordCount}, minRingVertices=${minRingVertices ?? '-'}) (selfIntersections=${selfIntersectionCount}, degenerateRings=${degenerateRingCount}, duplicateVertices=${duplicateVertexCount}, minRingArea=${formatArea(minRingArea)}, maxRingArea=${formatArea(maxRingArea)}, maxRingVertices=${maxRingVertices ?? '-'}, avgRingVertices=${formatAverage(avgRingVertices)})${sampleDetails.length ? ` (samples=${sampleDetails.join(' | ')})` : ''}${analysisNote}`,
        };
      }
      const adminLevel = input.adminLevel;
      const layerName = typeof adminLevel === 'number' ? `admin${adminLevel}` : 'admin0';
      const boundaryLayerName = typeof adminLevel === 'number'
        ? `admin${adminLevel}-boundary`
        : 'admin0-boundary';

      const features: Feature[] = [];
      for (let index = 0; index < simplified.features.length; index++) {
        assertNotAborted(abortSignal);
        const feature = simplified.features[index];
        if (!feature) continue;
        const properties = {
          ...(feature.properties ?? {}),
          layer: layerName,
          level: adminLevel,
        } as Record<string, unknown> & { id?: string };
        const id = properties.id ?? `${input.sourceKey}:${index}`;
        properties.id = id;
        const featureWithId = { ...feature, id, properties };
        features.push(featureWithId);
        stageLabel = 'boundary';
        features.push(await runStageWithLabel('boundary', () => buildBoundaryFeature(featureWithId, boundaryLayerName, adminLevel)));
      }

      const outputCollectionValue: FeatureCollection = {
        type: 'FeatureCollection',
        features,
      };

      stageLabel = 'counts:output-vertices';
      const vertexCount = await runStageWithLabel('counts:output-vertices', () => features.reduce((sum, feature) => sum + countVerticesFromGeometry(feature.geometry), 0));
      stageLabel = 'counts:output-polygons';
      const polygonCount = await runStageWithLabel('counts:output-polygons', () => features.reduce((sum, feature) => sum + countPolygonsFromGeometry(feature.geometry), 0));
      assertNotAborted(abortSignal);
      stageLabel = 'encode';
      outputCollection = outputCollectionValue;
      const encoded = await runStageWithLabel('encode', () => encodeFlatGeobufFromFeatureCollection(outputCollectionValue));
      const extractionRatio = inputFeatureCount > 0 ? simplified.features.length / inputFeatureCount : 0;
      const cacheId = `${task.nodeId}-b${input.bandId}-${SHAPE_DOMAIN}-${input.sourceKey}`;

      stageLabel = 'cache:put';
      assertNotAborted(abortSignal);
      await ephemeralDB.transformCache.put({
        id: cacheId,
        nodeId: task.nodeId,
        bandId: input.bandId,
        domainType: input.domainType,
        sourceKey: input.sourceKey,
        countryCode: input.countryCode,
        adminLevel: input.adminLevel,
        data: encoded,
        featureCount: features.length,
        vertexCount,
        polygonCount,
        extractionRatio,
        tolerance: tolerance,
        timestamp: 0,
      });
      await ephemeralDB.transformCache.update(cacheId, { timestamp: Date.now() });
      await ephemeralDB.transaction('rw', ephemeralDB.transformCache, async () => {
        await ephemeralDB.transformCache.put({
          id: cacheId,
          nodeId: task.nodeId,
          bandId: input.bandId,
          domainType: input.domainType,
          sourceKey: input.sourceKey,
          countryCode: input.countryCode,
          adminLevel: input.adminLevel,
          data: encoded,
          featureCount: features.length,
          vertexCount,
          polygonCount,
          extractionRatio,
          tolerance: tolerance,
          timestamp: 0,
        });
        await ephemeralDB.transformCache.update(cacheId, { timestamp: Date.now() });
      });

      const tileIds = collectTileIdsForCollection(outputCollectionValue, band.zBase);
      if (tileIds.length > 0) {
        const createdAt = Date.now();
        const relations = tileIds.map((tileId) => ({
          id: `${task.nodeId}:${input.bandId}:${tileId}:${cacheId}`,
          nodeId: task.nodeId,
          bandId: input.bandId,
          tileId: String(tileId),
          bufferId: cacheId,
          createdAt,
        }));
        try {
          await ephemeralDB.tileIdToBufferRelations.where('bufferId').equals(cacheId).delete();
          await ephemeralDB.tileIdToBufferRelations.bulkPut(relations);
        } catch (storageError) {
          console.warn('[ShapeTransform] failed to persist tile index relations', storageError);
        }
      }

      const completedMessage = `Features=${inputFeatureCount} Polygons=${polygonCount} Geometries=${vertexCount}`;
      return {
        status: 'completed',
        progress: 100,
        message: completedMessage,
        outputData: {
          processedPolygons: inputPolygonCount,
          totalPolygons: inputPolygonCount,
        },
      };
    } catch (error) {
      if (abortSignal?.aborted) {
        throw error;
      }
      const err = error instanceof Error ? error.message : String(error);
      const stagedError = err.startsWith('stage=') ? err : `stage=${stageLabel} ${err}`;
      const diagnostics = [
        buildCollectionDiagnostics(workingCollection, 'input'),
        buildCollectionDiagnostics(simplified, 'simplified'),
        buildCollectionDiagnostics(outputCollection, 'output'),
      ].filter((value): value is string => Boolean(value)).join(' ');
      await reportPolygonProgress(task.taskId, 0, inputPolygonCount);
      return {
        status: 'failed',
        errorMessage: `transform failed: ${stagedError}${diagnostics ? ` ${diagnostics}` : ''}`,
      };
    }
  };
};
