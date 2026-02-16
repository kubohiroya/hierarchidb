import { describe, expect, it } from 'vitest';
import { DEFAULT_BUILD_CONFIG } from '../../common/types/constants.js';
import { mergeBuildConfig } from '../../services/utils/utils.js';
import type { ShapeBuildConfig } from '../../common/types/index.js';

describe('mergeBuildConfig', () => {
  it('preserves omitDetailsConfig.level when override provides empty omitDetailsConfig object', () => {
    const merged = mergeBuildConfig(
      DEFAULT_BUILD_CONFIG,
      {
        transformConfig: {
          omitDetailsConfig: {},
        },
      } as unknown as Partial<ShapeBuildConfig>,
    );

    expect(merged.transformConfig.omitDetailsConfig.level).toBe(
      DEFAULT_BUILD_CONFIG.transformConfig.omitDetailsConfig.level,
    );
  });

  it('applies omitDetailsConfig.level override when a valid level is provided', () => {
    const merged = mergeBuildConfig(DEFAULT_BUILD_CONFIG, {
      transformConfig: {
        omitDetailsConfig: {
          level: 'weak',
        },
      },
    });

    expect(merged.transformConfig.omitDetailsConfig.level).toBe('weak');
  });

  it('normalizes legacy omitDetailsConfig level aliases from persisted drafts', () => {
    const mergedFromNone = mergeBuildConfig(
      DEFAULT_BUILD_CONFIG,
      {
        transformConfig: {
          omitDetailsConfig: {
            level: 'none',
          },
        },
      } as unknown as Partial<ShapeBuildConfig>,
    );
    const mergedFromModerate = mergeBuildConfig(
      DEFAULT_BUILD_CONFIG,
      {
        transformConfig: {
          omitDetailsConfig: {
            level: 'moderate',
          },
        },
      } as unknown as Partial<ShapeBuildConfig>,
    );

    expect(mergedFromNone.transformConfig.omitDetailsConfig.level).toBe('weak');
    expect(mergedFromModerate.transformConfig.omitDetailsConfig.level).toBe('medium');
  });

  it('throws for unsupported omitDetailsConfig level values', () => {
    expect(() =>
      mergeBuildConfig(
        DEFAULT_BUILD_CONFIG,
        {
          transformConfig: {
            omitDetailsConfig: {
              level: 'invalid-level',
            },
          },
        } as unknown as Partial<ShapeBuildConfig>,
      ),
    ).toThrow('unsupported omit-details level: invalid-level');
  });

  it('applies simplify algorithm override', () => {
    const merged = mergeBuildConfig(DEFAULT_BUILD_CONFIG, {
      transformConfig: {
        simplifyAlgorithm: 'geojson',
      },
    });

    expect(merged.transformConfig.simplifyAlgorithm).toBe('geojson');
  });

  it('merges intake guard and anomaly guard overrides', () => {
    const merged = mergeBuildConfig(DEFAULT_BUILD_CONFIG, {
      fetchConfig: {
        geometryIntakeGuard: {
          validationLevel: 'strict',
          dedupeEpsilon: 0.00001,
          minRingAreaThreshold: 0.0001,
          normalizeRingOrientation: true,
          keepBaselineSnapshot: true,
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
        },
      },
    });

    expect(merged.fetchConfig.geometryIntakeGuard?.validationLevel).toBe('strict');
    expect(merged.transformConfig.executionLogLevel).toBe('verbose');
    expect(merged.transformConfig.anomalyDetection?.scoreThreshold).toBe(1.8);
    expect(merged.transformConfig.anomalyDetection?.geojson?.maxTriangleShareDriftPercent).toBe(4);
    expect(merged.transformConfig.anomalyDetection?.topojson?.minSharedArcRatioPercent).toBe(14);
    expect(merged.transformConfig.anomalyRetry?.fallbackMode).toBe('switch_algorithm');
    expect(merged.vtConfig.outputQualityGuard?.enablePreviewOverlay).toBe(true);
  });
});
