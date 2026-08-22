import { describe, expect, it } from 'vitest';
import { routeBuildUiAdapter } from '../routeBuildUiAdapter.js';

describe('routeBuildUiAdapter', () => {
  it('derives deterministic overall and per-stage progress from a canonical snapshot', () => {
    const progress = { stage: 'geometry', percentage: 50 };

    expect(routeBuildUiAdapter.resolveOverallProgress('running', progress)).toBe(50);
    expect(routeBuildUiAdapter.resolveStageProgress('running', progress)).toEqual({
      source: 100,
      geometry: 50,
      tileEmit: 0,
    });
  });

  it('maps queued canonical sessions to the idle panel status', () => {
    expect(routeBuildUiAdapter.resolveUiBuildStatus('queued')).toBe('idle');
  });

  it('rejects unknown canonical stages instead of accepting a fallback', () => {
    expect(() =>
      routeBuildUiAdapter.resolveOverallProgress('running', {
        stage: 'unknown-stage',
        percentage: 50,
      })
    ).toThrow(/unsupported canonical stage/);
  });

  it.each([-1, 101, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects canonical progress outside finite 0..100: %s',
    (percentage) => {
      expect(() =>
        routeBuildUiAdapter.resolveStageProgress('running', {
          stage: 'source',
          percentage,
        })
      ).toThrow(/must be finite 0\.\.100/);
    }
  );
});
