import { toNodeId } from '@hierarchidb/core-types';
import { describe, expect, it, vi } from 'vitest';
import { locationBuildUiAdapter } from '../locationBuildUiAdapter.js';

vi.mock('~/worker/canonicalBuildAPI.js', () => ({
  canonicalBuildAPI: {
    startBuildSession: vi.fn(),
    pauseBuildSession: vi.fn(),
    cancelQueuedBuildSession: vi.fn(),
  },
}));

describe('locationBuildUiAdapter', () => {
  it('derives deterministic overall and per-stage progress from a canonical source snapshot', () => {
    const progress = { stage: 'source', percentage: 75 };

    expect(locationBuildUiAdapter.resolveOverallProgress('running', progress)).toBe(75);
    expect(locationBuildUiAdapter.resolveStageProgress('running', progress)).toEqual({
      source: 75,
    });
  });

  it('maps queued canonical sessions to the idle panel status', () => {
    expect(locationBuildUiAdapter.resolveUiBuildStatus('queued')).toBe('idle');
  });

  it('rejects unknown canonical stages instead of accepting a fallback', () => {
    expect(() =>
      locationBuildUiAdapter.resolveOverallProgress('running', {
        stage: 'geometry',
        percentage: 50,
      })
    ).toThrow(/unsupported canonical stage/);
  });

  it.each([-1, 101, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects canonical progress outside finite 0..100: %s',
    (percentage) => {
      expect(() =>
        locationBuildUiAdapter.resolveStageProgress('running', {
          stage: 'source',
          percentage,
        })
      ).toThrow(/must be finite 0\.\.100/);
    }
  );

  it('requires a selected source row before enabling start or resume', () => {
    const nodeId = toNodeId('location-node');

    expect(
      locationBuildUiAdapter.hasRequiredFields(nodeId, {
        dataSource: 'openstreetmap',
        concurrentDownloads: 2,
        selectedArrayByCountries: { JP: [true, false, false, false, false] },
      })
    ).toBe(true);
    expect(
      locationBuildUiAdapter.hasRequiredFields(nodeId, {
        dataSource: 'openstreetmap',
        concurrentDownloads: 2,
        selectedArrayByCountries: { JP: [false, false, false, false, false] },
      })
    ).toBe(false);
  });
});
