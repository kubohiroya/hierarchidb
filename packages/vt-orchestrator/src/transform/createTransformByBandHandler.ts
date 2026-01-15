import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import { area as turfArea, bbox as turfBbox, kinks as turfKinks } from '@turf/turf';
import { geojson as geojsonApi } from 'flatgeobuf';
import { applyFeatureFiltering, encodeFlatGeobufFromFeatureCollection } from '@hierarchidb/gis-sdk';
import { simplifyFeatureCollection, buildBoundaryFeature } from './geometry.js';
import { SHAPE_DOMAIN } from '@hierarchidb/vt-shape-store';
import type { TransformByBandStageContext } from '../contexts.js';
import type { StageHandler, StageHandlerResult, TransformByBandTaskInput } from '../types/types.js';

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

type GeometryIssueSummary = {
  geometryType: string;
  polygonCount: number;
  ringCount: number;
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
  return {
    emptyRingCount,
    invalidRingCount,
    openRingCount,
    nonFiniteCoordCount,
    ringVertices,
    ringArea,
    degenerateRingCount,
    duplicateVertexCount,
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
  }
  return {
    polygonCount: 1,
    ringCount,
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
    return {
      geometryType: 'Polygon',
      ...analyzePolygon(rings),
      selfIntersectionCount: countSelfIntersections(geometry),
    };
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
    summary.avgRingVertices = ringCount > 0 ? ringVertexTotal / ringCount : null;
    return summary;
  }

  return buildEmptyGeometrySummary(geometry.type);
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

export const createTransformByBandHandler = (
  context: TransformByBandStageContext
): StageHandler<TransformByBandTaskInput> => {
  const { shapeDB, ephemeralDB, transformByBandConfig, bands, abortSignal } = context;
  const tolerance = transformByBandConfig.tolerance;
  if (typeof tolerance !== 'number') {
    throw new Error('transform-by-band requires tolerance');
  }
  const bandMap = new Map(bands.map((band) => [band.bandId, band] as const));

  return async (task): Promise<StageHandlerResult> => {
    const input = task.inputData;
    if (!input) {
      return { status: 'failed', errorMessage: 'transform-by-band failed: task input is missing' };
    }
    const band = bandMap.get(input.bandId);
    if (!band) {
      return { status: 'failed', errorMessage: `transform-by-band failed: unknown bandId (${input.bandId})` };
    }

    assertNotAborted(abortSignal);
    const fetchCache = await shapeDB.fetchCache.get(input.fetchCacheId);
    if (!fetchCache) {
      return { status: 'failed', errorMessage: 'transform-by-band failed: fetch cache not found' };
    }

    assertNotAborted(abortSignal);
    const collection = await decodeFetchCache(fetchCache.data);
    if (!collection || collection.features.length === 0) {
      return { status: 'failed', errorMessage: 'transform-by-band failed: empty fetch cache' };
    }

    let workingCollection = collection;
    if (transformByBandConfig.enableFeatureFiltering) {
      assertNotAborted(abortSignal);
      const filtered = applyFeatureFiltering(workingCollection, {
        minArea: transformByBandConfig.featureAreaThreshold,
        featureFilterMethod: transformByBandConfig.featureFilterMethod,
        minVertexCountForAreaFilter: transformByBandConfig.minVertexCountForAreaFilter,
        hybridFilterConfig: transformByBandConfig.hybridFilterConfig,
      });
      if (filtered && typeof filtered === 'object' && (filtered as FeatureCollection).type === 'FeatureCollection') {
        workingCollection = filtered as FeatureCollection;
      }
      const filteredFeatures = filterFeaturesByAspectRatioAndArea(
        workingCollection.features,
        transformByBandConfig.aspectRatioThreshold,
        transformByBandConfig.areaThreshold,
      );
      workingCollection = { ...workingCollection, features: filteredFeatures };
    }

    assertNotAborted(abortSignal);
    const inputFeatureCount = workingCollection.features.length;
    const inputMissingGeometry = workingCollection.features.filter((feature) => !feature?.geometry).length;
    const inputPolygonCount = workingCollection.features.reduce(
      (sum, feature) => sum + countPolygonsFromGeometry(feature?.geometry),
      0,
    );
    let simplified: FeatureCollection;
    try {
      assertNotAborted(abortSignal);
      simplified = simplifyFeatureCollection(workingCollection, band.zMax, tolerance);
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
      let minRingVertices: number | null = null;
      let maxRingVertices: number | null = null;
      let ringVertexTotal = 0;
      let ringCount = 0;
      let degenerateRingCount = 0;
      let duplicateVertexCount = 0;
      let selfIntersectionCount = 0;
      let minRingArea: number | null = null;
      let maxRingArea: number | null = null;
      const formatArea = (value: number | null): string => (
        value === null || !Number.isFinite(value) ? '-' : value.toExponential(2)
      );
      const formatAverage = (value: number | null): string => (
        value === null || !Number.isFinite(value) ? '-' : value.toFixed(2)
      );
      const sampleDetails: string[] = [];
      for (const feature of workingCollection.features) {
        assertNotAborted(abortSignal);
        if (!feature?.geometry) continue;
        try {
          simplifyFeatureCollection({ type: 'FeatureCollection', features: [feature] }, band.zMax, tolerance);
        } catch {
          errorFeatureCount += 1;
          errorPolygonCount += countPolygonsFromGeometry(feature.geometry);
          const summary = analyzeGeometryIssues(feature.geometry);
          invalidRingCount += summary.invalidRingCount;
          openRingCount += summary.openRingCount;
          emptyRingCount += summary.emptyRingCount;
          nonFiniteCoordCount += summary.nonFiniteCoordCount;
          degenerateRingCount += summary.degenerateRingCount;
          duplicateVertexCount += summary.duplicateVertexCount;
          selfIntersectionCount += summary.selfIntersectionCount;
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
              `${featureId} type=${summary.geometryType} rings=${summary.ringCount} minRingVertices=${summary.minRingVertices ?? '-'} kinks=${summary.selfIntersectionCount} degenerateRings=${summary.degenerateRingCount} minRingArea=${formatArea(summary.minRingArea)} invalidRings=${summary.invalidRingCount} openRings=${summary.openRingCount} nonFinite=${summary.nonFiniteCoordCount}`,
            );
          }
        }
      }
      const avgRingVertices = ringCount > 0 ? ringVertexTotal / ringCount : null;
      return {
        status: 'failed',
        errorMessage: `transform-by-band failed: geometry simplify error (extract1/${band.zMax}) (${err}) (features=${errorFeatureCount}/${inputFeatureCount}, polygons=${errorPolygonCount}/${inputPolygonCount}, missingGeometry=${inputMissingGeometry}) (invalidRings=${invalidRingCount}, openRings=${openRingCount}, emptyRings=${emptyRingCount}, nonFiniteCoords=${nonFiniteCoordCount}, minRingVertices=${minRingVertices ?? '-'}) (selfIntersections=${selfIntersectionCount}, degenerateRings=${degenerateRingCount}, duplicateVertices=${duplicateVertexCount}, minRingArea=${formatArea(minRingArea)}, maxRingArea=${formatArea(maxRingArea)}, maxRingVertices=${maxRingVertices ?? '-'}, avgRingVertices=${formatAverage(avgRingVertices)})${sampleDetails.length ? ` (samples=${sampleDetails.join(' | ')})` : ''}`,
      };
    }
    if (simplified.features.length === 0) {
      return {
        status: 'failed',
        errorMessage: `transform-by-band failed: simplified features empty (features=${inputFeatureCount}, polygons=${inputPolygonCount}, missingGeometry=${inputMissingGeometry})`,
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
      features.push(buildBoundaryFeature(featureWithId, boundaryLayerName, adminLevel));
    }

    const outputCollection: FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    const vertexCount = features.reduce((sum, feature) => sum + countVerticesFromGeometry(feature.geometry), 0);
    const polygonCount = features.reduce((sum, feature) => sum + countPolygonsFromGeometry(feature.geometry), 0);
    assertNotAborted(abortSignal);
    const encoded = await encodeFlatGeobufFromFeatureCollection(outputCollection);
    const extractionRatio = inputFeatureCount > 0 ? simplified.features.length / inputFeatureCount : 0;
    const cacheId = `${task.nodeId}-b${input.bandId}-${SHAPE_DOMAIN}-${input.sourceKey}`;

    assertNotAborted(abortSignal);
    await ephemeralDB.transformByBandCache.put({
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
      timestamp: Date.now(),
    });

    return { status: 'completed', progress: 100 };
  };
};
