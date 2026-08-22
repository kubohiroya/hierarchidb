import type { Feature } from 'geojson';
import { describe, expect, it } from 'vitest';
import { retrySimplifyFeatureWithinVertexLimit } from '../createTransformByBandHandler/transformByBandRetrySimplify.js';

const buildLineFeature = (vertexCount: number): Feature => {
  const coordinates = Array.from(
    { length: vertexCount },
    (_, index) => [index, index] as [number, number]
  );
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates,
    },
  };
};

describe('retrySimplifyFeatureWithinVertexLimit', () => {
  it('never exceeds maxRetryAttempts', async () => {
    const baseFeature = buildLineFeature(10);
    const attempts: Array<{ attempt: number; attemptTotal: number; tolerance: number }> = [];

    const result = await retrySimplifyFeatureWithinVertexLimit({
      feature: baseFeature,
      baseTolerance: 0.2,
      retryVertexLimit: 5,
      maxRetryAttempts: 3,
      maxTolerance: 1.6,
      minTolerance: 0.2,
      featureIndex: 1,
      featureTotal: 1,
      runRetrySimplifyAttempt: async (tolerance) =>
        tolerance >= 1 ? buildLineFeature(4) : buildLineFeature(10),
      countVerticesFromGeometry: (geometry) => {
        if (!geometry || geometry.type !== 'LineString') return 0;
        return geometry.coordinates.length;
      },
      updateRetrySimplifyAttemptPhase: async (params) => {
        attempts.push({
          attempt: params.attempt,
          attemptTotal: params.attemptTotal,
          tolerance: params.tolerance,
        });
      },
    });

    expect(result.retryAttempts).toBe(3);
    expect(attempts).toHaveLength(3);
    expect(attempts.map((entry) => entry.attempt)).toEqual([1, 2, 3]);
    expect(attempts.map((entry) => entry.attemptTotal)).toEqual([3, 3, 3]);
  });
});
