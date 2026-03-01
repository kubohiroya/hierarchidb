import { describe, expect, it } from 'vitest';
import type { GeometryConfig } from '@hierarchidb/gis-sdk';
import { resolveSimplifyToleranceProfile } from '../createTransformByBandHandler/helpers/simplifyProfile.js';

const createBaseTransformConfig = (): GeometryConfig => ({
  zoomBandBoundaries: [1, 4],
  maxConcurrent: 1,
  geometryEngine: 'turf',
  simplifyAlgorithm: 'topojson',
  preserveTopology: true,
  executionLogLevel: 'summary',
  enableFeatureFiltering: false,
  featureAreaThreshold: 1,
  minVertexCountForAreaFilter: 10,
  aspectRatioThreshold: 5,
  featureFilterMethod: 'hybrid',
  hybridFilterConfig: {
    quickRejectThreshold: 0.002,
    regularShapeMinRatio: 0.5,
    regularShapeMaxRatio: 2,
    simpleShapeVertexThreshold: 10,
    elongatedShapeCorrectionFactor: 1.3,
  },
  deleteOnComplete: false,
  toleranceByBand: [0.1, 0.2],
  retryCount: 4,
  retryToleranceByBand: [3, 2],
  areaThreshold: 1,
  excludePolygonAreaCoefficient: 1,
  omitDetailsConfig: {
    level: 'strong',
  },
  minRingVertices: 4,
  boundaryDisableAtZoomOrAbove: 3,
});

describe('resolveSimplifyToleranceProfile', () => {
  it('uses base transform values when admin-level config is not provided', () => {
    const config = createBaseTransformConfig();

    const profile = resolveSimplifyToleranceProfile(config, 2);

    expect(profile.toleranceByBand).toEqual([0.1, 0.2]);
    expect(profile.retryToleranceByBand).toEqual([3, 2]);
    expect(profile.retryCount).toBe(4);
  });

  it('resolves admin 1 from admin0 when usePrevious is enabled', () => {
    const config = createBaseTransformConfig();
    config.simplifyToleranceByAdminLevel = {
      admin0: {
        toleranceByBand: [0.25, 0.35],
        retryToleranceByBand: [2.5, 2],
        retryCount: 5,
      },
      admin1: {
        usePrevious: true,
        toleranceByBand: [0.9, 0.9],
      },
      admin2: {
        usePrevious: true,
      },
      admin3Plus: {
        usePrevious: true,
      },
    };

    const profile = resolveSimplifyToleranceProfile(config, 1);

    expect(profile.toleranceByBand).toEqual([0.25, 0.35]);
    expect(profile.retryToleranceByBand).toEqual([2.5, 2]);
    expect(profile.retryCount).toBe(5);
  });

  it('uses dedicated admin 2 profile when usePrevious is disabled', () => {
    const config = createBaseTransformConfig();
    config.simplifyToleranceByAdminLevel = {
      admin0: {
        toleranceByBand: [0.11, 0.21],
      },
      admin1: {
        usePrevious: true,
      },
      admin2: {
        usePrevious: false,
        toleranceByBand: [0.31, 0.41],
        retryToleranceByBand: [1.9, 1.7],
        retryCount: 2,
      },
      admin3Plus: {
        usePrevious: true,
      },
    };

    const profile = resolveSimplifyToleranceProfile(config, 2);

    expect(profile.toleranceByBand).toEqual([0.31, 0.41]);
    expect(profile.retryToleranceByBand).toEqual([1.9, 1.7]);
    expect(profile.retryCount).toBe(2);
  });

  it('maps admin level 3+ to admin3Plus profile', () => {
    const config = createBaseTransformConfig();
    config.simplifyToleranceByAdminLevel = {
      admin0: {
        toleranceByBand: [0.15, 0.25],
      },
      admin1: {
        usePrevious: true,
      },
      admin2: {
        usePrevious: false,
        toleranceByBand: [0.35, 0.45],
      },
      admin3Plus: {
        usePrevious: false,
        toleranceByBand: [0.55, 0.65],
        retryToleranceByBand: [1.5, 1.4],
        retryCount: 1,
      },
    };

    const profile = resolveSimplifyToleranceProfile(config, 5);

    expect(profile.toleranceByBand).toEqual([0.55, 0.65]);
    expect(profile.retryToleranceByBand).toEqual([1.5, 1.4]);
    expect(profile.retryCount).toBe(1);
  });
});
