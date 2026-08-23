import { describe, expect, it } from 'vitest';
import { RouteEngineInvalidResponseError, validateRouteGenerationResult } from '../index.js';

const request = {
  method: 'great_circle' as const,
  points: [
    [170, 10],
    [-170, 12],
  ] satisfies [number, number][],
};

describe('validateRouteGenerationResult', () => {
  it('accepts a long route that preserves request endpoints', () => {
    const result = validateRouteGenerationResult({
      request,
      result: {
        lineGeometry: [
          [170, 10],
          [179, 11],
          [-179, 11.5],
          [-170, 12],
        ],
        distance: 2200000,
      },
    });

    expect(result.lineGeometry).toHaveLength(4);
    expect(result.distance).toBe(2200000);
  });

  it('rejects endpoint drift instead of accepting snapped geometry', () => {
    expect(() =>
      validateRouteGenerationResult({
        request,
        result: {
          lineGeometry: [
            [170.1, 10],
            [-170, 12],
          ],
          distance: 1,
        },
      })
    ).toThrow('start endpoint must match');
  });

  it('rejects coordinates outside WGS84 bounds', () => {
    expect(() =>
      validateRouteGenerationResult({
        request,
        result: {
          lineGeometry: [
            [170, 10],
            [190, 10],
            [-170, 12],
          ],
          distance: 1,
        },
      })
    ).toThrow(RouteEngineInvalidResponseError);
  });

  it('rejects missing distance metadata', () => {
    expect(() =>
      validateRouteGenerationResult({
        request,
        result: {
          lineGeometry: [
            [170, 10],
            [-170, 12],
          ],
        },
      })
    ).toThrow('distance must be a finite non-negative number');
  });
});
