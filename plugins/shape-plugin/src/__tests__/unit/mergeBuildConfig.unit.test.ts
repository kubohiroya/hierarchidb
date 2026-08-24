import { describe, expect, it } from 'vitest';
import { DEFAULT_BUILD_CONFIG, DEFAULT_PROCESSING_CONFIG } from '../../common/types/constants';
import type { ShapeBuildConfig } from '../../common/types/BuildTaskResult.js';
import {
  applyBuildConfigPatch,
  assertShapeBuildConfigTileEmitContract,
  composeRuntimeBuildConfig,
} from '../../services/utils/shapeBuildUtils';

describe('applyBuildConfigPatch', () => {
  it('preserves omitDetailsConfig.level when override provides empty omitDetailsConfig object', () => {
    const merged = applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, {
      geometryConfig: {
        omitDetailsConfig: {},
      },
    } as Partial<ShapeBuildConfig>);

    expect(merged.geometryConfig.omitDetailsConfig.level).toBe(
      DEFAULT_BUILD_CONFIG.geometryConfig.omitDetailsConfig.level
    );
  });

  it('applies omitDetailsConfig.level override when a valid level is provided', () => {
    const merged = applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, {
      geometryConfig: {
        omitDetailsConfig: {
          level: 'weak',
        },
      },
    });

    expect(merged.geometryConfig.omitDetailsConfig.level).toBe('weak');
  });

  it('normalizes legacy omitDetailsConfig level aliases from persisted drafts', () => {
    const mergedFromNone = applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, {
      geometryConfig: {
        omitDetailsConfig: {
          level: 'none',
        },
      },
    } as Partial<ShapeBuildConfig>);
    const mergedFromModerate = applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, {
      geometryConfig: {
        omitDetailsConfig: {
          level: 'moderate',
        },
      },
    } as Partial<ShapeBuildConfig>);

    expect(mergedFromNone.geometryConfig.omitDetailsConfig.level).toBe('weak');
    expect(mergedFromModerate.geometryConfig.omitDetailsConfig.level).toBe('medium');
  });

  it('throws for unsupported omitDetailsConfig level values', () => {
    expect(() =>
      applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, {
        geometryConfig: {
          omitDetailsConfig: {
            level: 'invalid-level',
          },
        },
      } as Partial<ShapeBuildConfig>)
    ).toThrow('unsupported omit-details level: invalid-level');
  });

  it('applies simplify algorithm override', () => {
    const merged = applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, {
      geometryConfig: {
        simplifyAlgorithm: 'geojson',
      },
    });

    expect(merged.geometryConfig.simplifyAlgorithm).toBe('geojson');
  });

  it('normalizes incomplete toleranceByBand with default geometry preset values', () => {
    const merged = applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, {
      geometryConfig: {
        toleranceByBand: [0.12],
      },
    });

    expect(merged.geometryConfig.toleranceByBand).toEqual([0.12]);
  });

  it('normalizes incomplete retryToleranceByBand with default retry preset values', () => {
    const merged = applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, {
      geometryConfig: {
        retryToleranceByBand: [2.5],
      },
    });

    expect(merged.geometryConfig.retryToleranceByBand).toEqual([2.5]);
  });

  it('merges intake guard and anomaly guard overrides', () => {
    const merged = applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, {
      sourceConfig: {
        geometryIntakeGuard: {
          validationLevel: 'strict',
          dedupeEpsilon: 0.00001,
          minRingAreaThreshold: 0.0001,
          normalizeRingOrientation: true,
          keepBaselineSnapshot: true,
        },
      },
      geometryConfig: {
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
      tileEmitConfig: {
        invalidGeometryFilter: {
          area: true,
          lineLength: false,
          maxEdgeLength: true,
          selfIntersection: false,
          triangleRingRatio: true,
        },
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

    expect(merged.sourceConfig.geometryIntakeGuard?.validationLevel).toBe('strict');
    expect(merged.tileEmitConfig.invalidGeometryFilter.area).toBe(true);
    expect(merged.tileEmitConfig.invalidGeometryFilter.triangleRingRatio).toBe(true);
    expect(merged.geometryConfig.executionLogLevel).toBe('verbose');
    expect(merged.geometryConfig.anomalyDetection?.scoreThreshold).toBe(1.8);
    expect(merged.geometryConfig.anomalyDetection?.geojson?.maxTriangleShareDriftPercent).toBe(4);
    expect(merged.geometryConfig.anomalyDetection?.topojson?.minSharedArcRatioPercent).toBe(14);
    expect(merged.geometryConfig.anomalyRetry?.fallbackMode).toBe('switch_algorithm');
    expect(merged.tileEmitConfig.outputQualityGuard?.enablePreviewOverlay).toBe(true);
    expect(merged.tileEmitConfig.outputQualityGuard?.scoreThreshold).toBe(2.8);
    expect(merged.tileEmitConfig.outputQualityGuard?.minTriangleAngleDeg).toBe(15);
    expect(merged.tileEmitConfig.outputQualityGuard?.minEdgeToBaseRatio).toBe(3.1);
    expect(merged.tileEmitConfig.outputQualityGuard?.maxAreaToBBoxRatio).toBe(0.12);
    expect(merged.tileEmitConfig.outputQualityGuard?.minSpanRatio).toBe(0.04);
    expect(merged.tileEmitConfig.outputQualityGuard?.minBoundaryVertexCount).toBe(2);
  });
});

describe('composeRuntimeBuildConfig invalid geometry filter contract', () => {
  it.each(['fetchConfig', 'sourceConfig'] as const)('rejects the legacy %s key', (legacyOwner) => {
    const buildConfig = structuredClone(DEFAULT_BUILD_CONFIG) as ShapeBuildConfig &
      Record<string, unknown>;
    if (legacyOwner === 'fetchConfig') {
      buildConfig.fetchConfig = { invalidGeometryFilter: { area: true } };
    } else {
      (buildConfig.sourceConfig as unknown as Record<string, unknown>).invalidGeometryFilter = {
        area: true,
      };
    }

    expect(() => composeRuntimeBuildConfig(buildConfig, DEFAULT_PROCESSING_CONFIG)).toThrow(
      `${legacyOwner}.invalidGeometryFilter is not supported`
    );
  });

  it('rejects a missing required tileEmit boolean', () => {
    const buildConfig = structuredClone(DEFAULT_BUILD_CONFIG) as ShapeBuildConfig;
    delete (buildConfig.tileEmitConfig.invalidGeometryFilter as unknown as Record<string, unknown>)
      .lineLength;

    expect(() => composeRuntimeBuildConfig(buildConfig, DEFAULT_PROCESSING_CONFIG)).toThrow(
      'tileEmitConfig.invalidGeometryFilter.lineLength must be boolean'
    );
  });

  it('rejects an unsupported tileEmit filter key', () => {
    const buildConfig = structuredClone(DEFAULT_BUILD_CONFIG) as ShapeBuildConfig;
    (
      buildConfig.tileEmitConfig.invalidGeometryFilter as unknown as Record<string, unknown>
    ).legacyAreaCheck = true;

    expect(() => composeRuntimeBuildConfig(buildConfig, DEFAULT_PROCESSING_CONFIG)).toThrow(
      'tileEmitConfig.invalidGeometryFilter.legacyAreaCheck is not supported'
    );
  });

  it('rejects a missing required boolean before a received config can be default-filled', () => {
    const receivedConfig = structuredClone(DEFAULT_BUILD_CONFIG) as ShapeBuildConfig;
    delete (
      receivedConfig.tileEmitConfig.invalidGeometryFilter as unknown as Record<string, unknown>
    ).lineLength;

    expect(() => assertShapeBuildConfigTileEmitContract(receivedConfig)).toThrow(
      'tileEmitConfig.invalidGeometryFilter.lineLength must be boolean'
    );
  });

  it('rejects tile-local TopoJSON simplification after the canonical filter boundary', () => {
    const receivedConfig = structuredClone(DEFAULT_BUILD_CONFIG) as ShapeBuildConfig;
    receivedConfig.tileEmitConfig.enableTopojsonSimplify = true;

    expect(() => assertShapeBuildConfigTileEmitContract(receivedConfig)).toThrow(
      'tileEmitConfig.enableTopojsonSimplify must be false'
    );
  });
});
