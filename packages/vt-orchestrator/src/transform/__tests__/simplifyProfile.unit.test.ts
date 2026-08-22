import type { GeometryConfig } from '@hierarchidb/gis-sdk';
import { describe, expect, it } from 'vitest';
import { resolveSimplifyToleranceProfile } from '../createTransformByBandHandler/helpers/resolveSimplifyToleranceProfile.js';

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
  toleranceMultiplierByBand: [1, 1],
  toleranceMinRatioByBand: [0, 0],
  toleranceMaxRatioByBand: [2, 2],
  toleranceSearchMaxIterations: 24,
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

    expect(profile.multiplierByBand).toEqual([1, 1]);
    expect(profile.minRatioByBand).toEqual([0, 0]);
    expect(profile.maxRatioByBand).toEqual([2, 2]);
    expect(profile.toleranceSearchMaxIterations).toBe(24);
  });

  it('resolves admin 1 from admin0 when usePrevious is enabled', () => {
    const config = createBaseTransformConfig();
    config.simplifyToleranceByAdminLevel = {
      admin0: {
        multiplierByBand: [0.9, 1.1],
        minRatioByBand: [0.2, 0.3],
        maxRatioByBand: [1.6, 1.7],
        toleranceSearchMaxIterations: 30,
      },
      admin1: {
        usePrevious: true,
      },
      admin2: {
        usePrevious: true,
      },
      admin3Plus: {
        usePrevious: true,
      },
    };

    const profile = resolveSimplifyToleranceProfile(config, 1);

    expect(profile.multiplierByBand).toEqual([0.9, 1.1]);
    expect(profile.minRatioByBand).toEqual([0.2, 0.3]);
    expect(profile.maxRatioByBand).toEqual([1.6, 1.7]);
    expect(profile.toleranceSearchMaxIterations).toBe(30);
  });

  it('uses dedicated admin 2 profile when usePrevious is disabled', () => {
    const config = createBaseTransformConfig();
    config.simplifyToleranceByAdminLevel = {
      admin0: {},
      admin1: {
        usePrevious: true,
      },
      admin2: {
        usePrevious: false,
        multiplierByBand: [0.8, 0.7],
        minRatioByBand: [0.1, 0.1],
        maxRatioByBand: [1.4, 1.3],
      },
      admin3Plus: {
        usePrevious: true,
      },
    };

    const profile = resolveSimplifyToleranceProfile(config, 2);

    expect(profile.multiplierByBand).toEqual([0.8, 0.7]);
    expect(profile.minRatioByBand).toEqual([0.1, 0.1]);
    expect(profile.maxRatioByBand).toEqual([1.4, 1.3]);
  });

  it('maps admin level 3+ to admin3Plus profile', () => {
    const config = createBaseTransformConfig();
    config.simplifyToleranceByAdminLevel = {
      admin0: {},
      admin1: {
        usePrevious: true,
      },
      admin2: {
        usePrevious: false,
      },
      admin3Plus: {
        usePrevious: false,
        multiplierByBand: [1.2, 1.1],
        minRatioByBand: [0.4, 0.35],
        maxRatioByBand: [1.9, 1.8],
      },
    };

    const profile = resolveSimplifyToleranceProfile(config, 5);

    expect(profile.multiplierByBand).toEqual([1.2, 1.1]);
    expect(profile.minRatioByBand).toEqual([0.4, 0.35]);
    expect(profile.maxRatioByBand).toEqual([1.9, 1.8]);
  });
});
