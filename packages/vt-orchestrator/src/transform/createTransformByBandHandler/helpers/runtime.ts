import type { FeatureCollection } from 'geojson';
import type { GeometryOps } from './core.js';
import { analyzeGeometryIssues, isGeometryBooleanValid } from './analysis.js';
import { countPolygonsFromGeometry } from './validation.js';

export const assertNotAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new Error('task aborted');
  }
};

export const formatArea = (value: number | null): string => (
  value === null || !Number.isFinite(value) ? '-' : value.toExponential(2)
);

export const formatAverage = (value: number | null): string => (
  value === null || !Number.isFinite(value) ? '-' : value.toFixed(2)
);

export const formatToleranceForDisplay = (value: number): number => (
  Number.isFinite(value) ? Number(value.toFixed(4)) : value
);

export const runStageWithLabel = async <T>(label: string, fn: () => T | Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    throw new Error(`stage=${label} ${err}`);
  }
};

export const runWithStallTimeout = async <T>(params: {
  promise: Promise<T>;
  stage: string;
  nodeId: string;
  taskId: string;
  timeoutMs: number;
  getLastProgressAt: () => number;
  heartbeatMs?: number;
}): Promise<T> => {
  const {
    promise,
    stage,
    nodeId,
    taskId,
    timeoutMs,
    getLastProgressAt,
    heartbeatMs = 30000,
  } = params;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let lastHeartbeatAt = Date.now();
  const stallPromise = new Promise<never>((_resolve, reject) => {
    intervalId = setInterval(() => {
      const now = Date.now();
      const lastProgressAt = getLastProgressAt();
      const idleMs = now - lastProgressAt;
      if (idleMs >= timeoutMs) {
        reject(new Error(`transform failed: ${stage} stalled (${idleMs}ms without progress)`));
        return;
      }
      if (now - lastHeartbeatAt >= heartbeatMs) {
        lastHeartbeatAt = now;
        console.warn('[transform] stage heartbeat', {
          nodeId,
          taskId,
          stage,
          idleMs,
        });
      }
    }, Math.min(heartbeatMs, 10000));
  });
  try {
    return await Promise.race([promise, stallPromise]);
  } finally {
    if (intervalId) {
      clearInterval(intervalId);
    }
  }
};

export const buildCollectionDiagnostics = (
  collection: FeatureCollection | null,
  label: string,
  geometryOps: GeometryOps,
): string | null => {
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
    const summary = analyzeGeometryIssues(feature.geometry, geometryOps);
    invalidRingCount += summary.invalidRingCount;
    openRingCount += summary.openRingCount;
    emptyRingCount += summary.emptyRingCount;
    nonFiniteCoordCount += summary.nonFiniteCoordCount;
    degenerateRingCount += summary.degenerateRingCount;
    duplicateVertexCount += summary.duplicateVertexCount;
    selfIntersectionCount += summary.selfIntersectionCount;
    const isValid = isGeometryBooleanValid(feature.geometry, geometryOps);
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
