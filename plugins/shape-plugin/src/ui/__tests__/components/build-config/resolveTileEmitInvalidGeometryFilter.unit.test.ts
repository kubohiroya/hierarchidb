import { describe, expect, it } from 'vitest';
import type { ShapeBuildConfig } from '../../../../common/types/BuildTaskResult.js';
import { resolveTileEmitInvalidGeometryFilter } from '../../../components/build-config/TileEmitInvalidGeometryFilterCard/useTileEmitInvalidGeometryFilterCardState';

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

  it('rejects an unsupported filter key instead of ignoring it', () => {
    const config = {
      tileEmitConfig: {
        invalidGeometryFilter: {
          area: false,
          lineLength: false,
          maxEdgeLength: false,
          selfIntersection: false,
          triangleRingRatio: false,
          legacyAreaCheck: true,
        },
      },
    } as unknown as ShapeBuildConfig;

    expect(() => resolveTileEmitInvalidGeometryFilter(config)).toThrow(
      'invalidGeometryFilter.legacyAreaCheck is not supported'
    );
  });
});
