import { describe, expect, it } from 'vitest';
import {
  __test_applyGeometryIntakeGuard,
  assessAnomalyRisk,
  resolveSimplifyExecutionPath,
} from '../createTransformByBandHandler.js';

describe('resolveSimplifyExecutionPath', () => {
  it('returns topojson decode simplify path for topojson algorithm', () => {
    expect(resolveSimplifyExecutionPath({
      fetchFormat: 'topojson',
      simplifyAlgorithm: 'topojson',
    })).toBe('topojson_decode_simplify_geojson_skip');
  });

  it('returns topojson decode only path for geojson algorithm', () => {
    expect(resolveSimplifyExecutionPath({
      fetchFormat: 'topojson',
      simplifyAlgorithm: 'geojson',
    })).toBe('topojson_decode_only_geojson_run');
  });

  it('returns geojson decode path for non-topojson inputs', () => {
    expect(resolveSimplifyExecutionPath({
      fetchFormat: 'flatgeobuf',
      simplifyAlgorithm: 'geojson',
    })).toBe('geojson_decode_geojson_run');
  });
});

describe('assessAnomalyRisk', () => {
  it('detects polygon anomaly by edge ratio and area drift', () => {
    const baseline = {
      featureCount: 10,
      vertexCount: 1000,
      polygonCount: 10,
      lineCount: 0,
      totalArea: 100,
      totalLength: 500,
      maxEdgeLength: 10,
      selfIntersectionCount: 0,
      triangleRingCount: 0,
      triangleRingSharePercent: 0,
      maxTriangleEdgeToBBoxRatio: 0,
    };
    const candidate = {
      ...baseline,
      totalArea: 160,
      maxEdgeLength: 200,
      selfIntersectionCount: 3,
    };

    const assessed = assessAnomalyRisk({
      profile: 'polygon',
      baseline,
      candidate,
      thresholds: {
        maxEdgeLengthRatio: 5,
        maxAreaDriftPercent: 20,
        maxSelfIntersectionCount: 0,
        maxLineLengthDriftPercent: 50,
        maxVertexDriftPercent: 30,
        geojson: {
          maxTriangleShareDriftPercent: 2,
          maxTriangleEdgeToBBoxRatio: 1.15,
        },
        topojson: {
          minSharedArcRatioPercent: 10,
        },
      },
    });

    expect(assessed.isAnomalous).toBe(true);
    expect(assessed.reasons).toContain('edgeLengthRatio>5');
    expect(assessed.reasons).toContain('areaDriftPercent>20');
    expect(assessed.reasons).toContain('selfIntersectionCount>0');
  });

  it('uses line drift threshold for line profile', () => {
    const baseline = {
      featureCount: 5,
      vertexCount: 100,
      polygonCount: 0,
      lineCount: 5,
      totalArea: 0,
      totalLength: 100,
      maxEdgeLength: 5,
      selfIntersectionCount: 0,
      triangleRingCount: 0,
      triangleRingSharePercent: 0,
      maxTriangleEdgeToBBoxRatio: 0,
    };
    const candidate = {
      ...baseline,
      totalLength: 200,
      maxEdgeLength: 6,
      totalArea: 1000,
      selfIntersectionCount: 999,
    };

    const assessed = assessAnomalyRisk({
      profile: 'line',
      baseline,
      candidate,
      thresholds: {
        maxEdgeLengthRatio: 10,
        maxAreaDriftPercent: 1,
        maxSelfIntersectionCount: 0,
        maxLineLengthDriftPercent: 30,
        maxVertexDriftPercent: 35,
        geojson: {
          maxTriangleShareDriftPercent: 2,
          maxTriangleEdgeToBBoxRatio: 1.15,
        },
        topojson: {
          minSharedArcRatioPercent: 10,
        },
      },
    });

    expect(assessed.isAnomalous).toBe(true);
    expect(assessed.reasons).toContain('lineLengthDriftPercent>30');
    expect(assessed.reasons.some((reason) => reason.startsWith('areaDriftPercent'))).toBe(false);
    expect(assessed.reasons.some((reason) => reason.startsWith('selfIntersectionCount'))).toBe(false);
  });

  it('detects geojson triangle drift anomaly using bbox-relative edge ratio', () => {
    const baseline = {
      featureCount: 8,
      vertexCount: 1000,
      polygonCount: 8,
      lineCount: 0,
      totalArea: 120,
      totalLength: 480,
      maxEdgeLength: 12,
      selfIntersectionCount: 0,
      triangleRingCount: 0,
      triangleRingSharePercent: 0,
      maxTriangleEdgeToBBoxRatio: 0.9,
    };
    const candidate = {
      ...baseline,
      triangleRingCount: 2,
      triangleRingSharePercent: 25,
      maxTriangleEdgeToBBoxRatio: 1.4,
    };
    const assessed = assessAnomalyRisk({
      profile: 'polygon',
      baseline,
      candidate,
      thresholds: {
        scoreThreshold: 0.75,
        maxEdgeLengthRatio: 100,
        maxAreaDriftPercent: 100,
        maxSelfIntersectionCount: 100,
        maxLineLengthDriftPercent: 100,
        maxVertexDriftPercent: 100,
        geojson: {
          maxTriangleShareDriftPercent: 5,
          maxTriangleEdgeToBBoxRatio: 1.1,
        },
        topojson: {
          minSharedArcRatioPercent: 5,
        },
      },
    });
    expect(assessed.isAnomalous).toBe(true);
    expect(assessed.reasons.some((reason) => reason.includes('triangleShareDriftPercent'))).toBe(true);
  });

  it('detects topojson shared-arc continuity anomaly', () => {
    const baseline = {
      featureCount: 8,
      vertexCount: 1000,
      polygonCount: 8,
      lineCount: 0,
      totalArea: 120,
      totalLength: 480,
      maxEdgeLength: 12,
      selfIntersectionCount: 0,
      triangleRingCount: 0,
      triangleRingSharePercent: 0,
      maxTriangleEdgeToBBoxRatio: 0.9,
    };
    const candidate = {
      ...baseline,
    };
    const assessed = assessAnomalyRisk({
      profile: 'polygon',
      baseline,
      candidate,
      thresholds: {
        scoreThreshold: 0.75,
        maxEdgeLengthRatio: 100,
        maxAreaDriftPercent: 100,
        maxSelfIntersectionCount: 100,
        maxLineLengthDriftPercent: 100,
        maxVertexDriftPercent: 100,
        geojson: {
          maxTriangleShareDriftPercent: 10,
          maxTriangleEdgeToBBoxRatio: 2,
        },
        topojson: {
          minSharedArcRatioPercent: 25,
        },
      },
      diagnostics: {
        topoSharedArcRatioPercent: 5,
      },
    });
    expect(assessed.isAnomalous).toBe(true);
    expect(assessed.reasons).toContain('topoSharedArcRatioPercent<25');
  });
});

describe('applyGeometryIntakeGuard', () => {
  const collection = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]],
        },
        properties: { id: 'feature-1' },
      },
    ],
  };

  it('skips expensive validity checks in basic mode', () => {
    let isValidCalls = 0;
    const result = __test_applyGeometryIntakeGuard({
      collection,
      validationLevel: 'basic',
      dedupeEpsilon: 0,
      minRingAreaThreshold: 0,
      normalizeRingOrientation: false,
      sourceKey: 'JP:1',
      geometryOps: {
        simplifyCollection: (input) => input,
        simplifyFeature: (input) => input,
        bbox: () => null,
        area: () => 0,
        isValid: () => {
          isValidCalls += 1;
          return true;
        },
        countSelfIntersections: () => 0,
        intersectsBBox: () => false,
      },
    });
    expect(result.validCheckCount).toBe(0);
    expect(isValidCalls).toBe(0);
  });

  it('runs validity checks in strict mode', () => {
    let isValidCalls = 0;
    const result = __test_applyGeometryIntakeGuard({
      collection,
      validationLevel: 'strict',
      dedupeEpsilon: 0,
      minRingAreaThreshold: 0,
      normalizeRingOrientation: false,
      sourceKey: 'JP:1',
      geometryOps: {
        simplifyCollection: (input) => input,
        simplifyFeature: (input) => input,
        bbox: () => null,
        area: () => 0,
        isValid: () => {
          isValidCalls += 1;
          return true;
        },
        countSelfIntersections: () => 0,
        intersectsBBox: () => false,
      },
    });
    expect(result.validCheckCount).toBe(1);
    expect(isValidCalls).toBe(1);
  });
});
