import { describe, expect, it } from 'vitest';
import type { ShapeBuildConfig } from '../../../../common/types/index';
import { resolveTileEmitInvalidGeometryFilter } from '../../../components/build-config/useTileEmitInvalidGeometryFilterCardView';

describe('resolveTileEmitInvalidGeometryFilter', () => {
  it('returns the five required booleans unchanged', () => {
    const expected = {
      area: false,
      lineLength: true,
      maxEdgeLength: false,
      selfIntersection: true,
      triangleRingRatio: false,
    };
    const config = {
      tileEmitConfig: { invalidGeometryFilter: expected },
    } as ShapeBuildConfig;

    expect(resolveTileEmitInvalidGeometryFilter(config)).toEqual(expected);
  });

  it('rejects a missing boolean instead of supplying a runtime default', () => {
    const config = {
      tileEmitConfig: {
        invalidGeometryFilter: { area: false },
      },
    } as unknown as ShapeBuildConfig;

    expect(() => resolveTileEmitInvalidGeometryFilter(config)).toThrow(
      'invalidGeometryFilter.lineLength must be boolean'
    );
  });
});
