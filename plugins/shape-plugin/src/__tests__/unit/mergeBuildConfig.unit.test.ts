import { describe, expect, it } from 'vitest';
import { DEFAULT_BUILD_CONFIG } from '../../common/types/constants';
import { applyBuildConfigPatch } from '../../services/utils/utils';
import type { ShapeBuildConfig } from '../../common/types/index';

describe('applyBuildConfigPatch', () => {
  it('preserves omitDetailsConfig.level when override provides empty omitDetailsConfig object', () => {
    const merged = applyBuildConfigPatch(
      DEFAULT_BUILD_CONFIG,
      {
        transformConfig: {
          omitDetailsConfig: {},
        },
      } as Partial<ShapeBuildConfig>,
    );

    expect(merged.transformConfig.omitDetailsConfig.level).toBe(
      DEFAULT_BUILD_CONFIG.transformConfig.omitDetailsConfig.level,
    );
  });

  it('applies omitDetailsConfig.level override when a valid level is provided', () => {
    const merged = applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, {
      transformConfig: {
        omitDetailsConfig: {
          level: 'weak',
        },
      },
    });

    expect(merged.transformConfig.omitDetailsConfig.level).toBe('weak');
  });

  it('normalizes legacy omitDetailsConfig level aliases from persisted drafts', () => {
    const mergedFromNone = applyBuildConfigPatch(
      DEFAULT_BUILD_CONFIG,
      {
        transformConfig: {
          omitDetailsConfig: {
            level: 'none',
          },
        },
      } as Partial<ShapeBuildConfig>,
    );
    const mergedFromModerate = applyBuildConfigPatch(
      DEFAULT_BUILD_CONFIG,
      {
        transformConfig: {
          omitDetailsConfig: {
            level: 'moderate',
          },
        },
      } as Partial<ShapeBuildConfig>,
    );

    expect(mergedFromNone.transformConfig.omitDetailsConfig.level).toBe('weak');
    expect(mergedFromModerate.transformConfig.omitDetailsConfig.level).toBe('medium');
  });

  it('throws for unsupported omitDetailsConfig level values', () => {
    expect(() =>
      applyBuildConfigPatch(
        DEFAULT_BUILD_CONFIG,
        {
          transformConfig: {
            omitDetailsConfig: {
              level: 'invalid-level',
            },
          },
        } as Partial<ShapeBuildConfig>,
      ),
    ).toThrow('unsupported omit-details level: invalid-level');
  });

  it('applies simplify algorithm override', () => {
    const merged = applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, {
      transformConfig: {
        simplifyAlgorithm: 'geojson',
      },
    });

    expect(merged.transformConfig.simplifyAlgorithm).toBe('geojson');
  });

  it('normalizes incomplete toleranceByBand with default transform preset values', () => {
    const merged = applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, {
      transformConfig: {
        toleranceByBand: [0.12],
      },
    });

    expect(merged.transformConfig.toleranceByBand).toEqual([0.12]);
  });

  it('normalizes incomplete retryToleranceByBand with default retry preset values', () => {
    const merged = applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, {
      transformConfig: {
        retryToleranceByBand: [2.5],
      },
    });

    expect(merged.transformConfig.retryToleranceByBand).toEqual([2.5]);
  });

  it('merges intake guard and anomaly guard overrides', () => {
    const merged = applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, {
      fetchConfig: {
        geometryIntakeGuard: {
          validationLevel: 'strict',
          dedupeEpsilon: 0.00001,
          minRingAreaThreshold: 0.0001,
          normalizeRingOrientation: true,
          keepBaselineSnapshot: true,
        },
        invalidGeometryFilter: {
          area: true,
          lineLength: false,
          maxEdgeLength: true,
          selfIntersection: false,
          triangleRingRatio: true,
        },
      },
      transformConfig: {
        executionLogLevel: 'verbose',
        anomalyDetection: {
          enabled: true,
          scoreThreshold: 1.8,
          maxEdgeLengthRatio: 6,
          maxAreaDriftPercent: 15,
          maxSelfIntersectionCount: 0,
          maxLineLengthDriftPercent: 20,
          maxVertexDriftPercent: 18,
          geojson: {
            maxTriangleShareDriftPercent: 4,
            maxTriangleEdgeToBBoxRatio: 1.2,
          },
          topojson: {
            minSharedArcRatioPercent: 14,
          },
        },
        anomalyRetry: {
          enabled: true,
          maxRetries: 3,
          toleranceScale: 0.8,
          fallbackMode: 'switch_algorithm',
        },
      },
      vtConfig: {
        outputQualityGuard: {
          enabled: true,
          minZoom: 3,
          maxZoom: 8,
          actionOnAnomaly: 'mark_warning',
          enablePreviewOverlay: true,
          scoreThreshold: 2.8,
          minTriangleAngleDeg: 15,
          minEdgeToBaseRatio: 3.1,
          maxAreaToBBoxRatio: 0.12,
          minSpanRatio: 0.04,
          minBoundaryVertexCount: 2,
        },
      },
    });

    expect(merged.fetchConfig.geometryIntakeGuard?.validationLevel).toBe('strict');
    expect(merged.fetchConfig.invalidGeometryFilter?.area).toBe(true);
    expect(merged.fetchConfig.invalidGeometryFilter?.triangleRingRatio).toBe(true);
    expect(merged.transformConfig.executionLogLevel).toBe('verbose');
    expect(merged.transformConfig.anomalyDetection?.scoreThreshold).toBe(1.8);
    expect(merged.transformConfig.anomalyDetection?.geojson?.maxTriangleShareDriftPercent).toBe(4);
    expect(merged.transformConfig.anomalyDetection?.topojson?.minSharedArcRatioPercent).toBe(14);
    expect(merged.transformConfig.anomalyRetry?.fallbackMode).toBe('switch_algorithm');
    expect(merged.vtConfig.outputQualityGuard?.enablePreviewOverlay).toBe(true);
    expect(merged.vtConfig.outputQualityGuard?.scoreThreshold).toBe(2.8);
    expect(merged.vtConfig.outputQualityGuard?.minTriangleAngleDeg).toBe(15);
    expect(merged.vtConfig.outputQualityGuard?.minEdgeToBaseRatio).toBe(3.1);
    expect(merged.vtConfig.outputQualityGuard?.maxAreaToBBoxRatio).toBe(0.12);
    expect(merged.vtConfig.outputQualityGuard?.minSpanRatio).toBe(0.04);
    expect(merged.vtConfig.outputQualityGuard?.minBoundaryVertexCount).toBe(2);
  });
});
